import datetime as dt
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import generate_text
from app.ai.fallback import daily_message_for, fallback_interpretation
from app.api.deps import get_current_user
from app.api.subscriptions import require_quota
from app.config import settings
from app.db import get_db
from app.tarot.schemas import DrawnCard
from app.tarot.visibility import stored_cards
from app.moderation import ensure_question_allowed
from app.models import DailyMessage, SpreadFollowUp, SpreadRecord, Subscription, User
from app.subscriptions import FREE_TEXT_TIERS
from app.spreads import SpreadId

router = APIRouter(prefix="/api", tags=["ai"])

# Preset follow-up questions offered under an already-unlocked
# interpretation (see ask_follow_up below). Keys are stable identifiers
# stored on SpreadFollowUp rows — never repurpose one for a different
# question. IMPORTANT: keep these labels in sync with
# frontend/src/components/FollowUpQuestions/FollowUpQuestions.tsx.
FOLLOW_UP_QUESTIONS: dict[str, str] = {
    "risks": "Какие риски?",
    "future": "Что в будущем?",
    "potential": "Есть ли перспектива?",
    "advice": "Что делать?",
}


class DailyMessageResponse(BaseModel):
    text: str


class InterpretationResponse(BaseModel):
    interpretation: str
    # Разблокировка оплачивается один раз и открывает расклад целиком,
    # поэтому карты приезжают вместе с толкованием — до этого момента
    # api/spreads.py их не отдаёт.
    cards: list[DrawnCard] = []


class FollowUpRequest(BaseModel):
    # Exactly one of these is set: question_key picks one of the preset
    # FOLLOW_UP_QUESTIONS; custom_question is the paid-tier-exclusive
    # free-text alternative (see ask_follow_up).
    question_key: str | None = None
    custom_question: str | None = None


class FollowUpResponse(BaseModel):
    question_key: str
    question_label: str
    answer: str


@router.get("/daily-message", response_model=DailyMessageResponse)
async def get_daily_message(db: Session = Depends(get_db)) -> DailyMessageResponse:
    today = dt.datetime.utcnow().date()
    key = today.isoformat()

    cached = db.get(DailyMessage, key)
    if cached is not None:
        return DailyMessageResponse(text=cached.text)

    generated = await generate_text(
        system_prompt=(
            "Ты пишешь одну короткую мотивирующую фразу дня для приложения "
            "с раскладами таро. Тон — тёплый, спокойный, без эзотерического "
            "жаргона и без гаданий по картам. Одно предложение, на русском "
            "языке, не длиннее 18 слов, без кавычек и без смайликов."
        ),
        user_prompt="Напиши фразу дня.",
        max_tokens=80,
    )
    text = generated or daily_message_for(today.timetuple().tm_yday)

    db.add(DailyMessage(date=key, text=text))
    db.commit()
    return DailyMessageResponse(text=text)


@router.post("/spreads/{spread_record_id}/interpret", response_model=InterpretationResponse)
async def interpret_spread(
    spread_record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterpretationResponse:
    """
    Generates (or returns the already-generated) AI interpretation for a
    spread. This is the paid "подробное толкование" feature — requires an
    active subscription with quota left (see api/subscriptions.py). Once
    generated, the text is cached on the record so re-opening it later
    (e.g. from History) doesn't re-consume quota or re-call the AI.
    """
    record = db.get(SpreadRecord, spread_record_id)
    if record is None or record.user_id != user.telegram_id:
        raise HTTPException(status_code=404, detail="Spread not found")

    if record.interpretation:
        return InterpretationResponse(interpretation=record.interpretation, cards=stored_cards(record))

    # "Карта дня" is free — the one lightweight daily hook, unlike the
    # paid multi-card readings. Everything else costs one unlock, and
    # that single unlock buys the whole reading: the cards become
    # visible at the same moment their interpretation does.
    is_daily_card = record.spread_id == SpreadId.DAILY_CARD.value
    if not is_daily_card:
        require_quota(db, user)

    if not record.unlocked:
        record.unlocked = True
        db.commit()

    cards = json.loads(record.cards_json)
    card_lines = "\n".join(
        f"- {c['position_label']}: {c['name']}"
        f"{' (перевёрнутая)' if c['is_reversed'] else ''}"
        for c in cards
    )
    interests_line = f"Пользователя обычно интересуют темы: {user.interests}." if user.interests else ""
    question_line = f"Вопрос пользователя к этому раскладу: «{record.question}»." if record.question else ""

    generated = await generate_text(
        system_prompt=(
            "Ты — тёплый и внятный толкователь таро. Дай связное толкование "
            "расклада на русском языке, 130-170 слов, обычным текстом без "
            "заголовков и списков. Опирайся на позиции карт и то, как они "
            "сочетаются между собой, а не разбирай каждую карту по отдельности "
            "в отрыве от остальных. Если дан вопрос пользователя — явно свяжи "
            "толкование с ним. Не давай медицинских, юридических или "
            "финансовых советов, не утверждай ничего как гарантированный факт "
            "о будущем. Обязательно уложись в объём и закончи текст полным "
            "завершающим предложением — никогда не обрывай мысль на середине."
        ),
        user_prompt=(
            f"Расклад «{record.spread_title}»:\n{card_lines}\n\n{question_line}\n{interests_line}"
        ),
        max_tokens=900,
    )
    text = generated or fallback_interpretation([c["name"] for c in cards], record.spread_title)

    # Only persist a real AI result. Caching the static fallback would
    # permanently strand a paid interpretation behind generic text after a
    # transient provider outage — leaving it uncached means the next open
    # (this is a paid feature, so re-calling costs nothing extra) retries
    # generation instead of repeating the same stale placeholder forever.
    if generated:
        record.interpretation = text
        db.commit()
    return InterpretationResponse(interpretation=text, cards=stored_cards(record))


def _can_ask_free_text(db: Session, user: User) -> bool:
    """
    Тарифы, где вопрос можно задать своими словами. Список живёт в
    app/subscriptions.py, чтобы добавление тарифа не требовало помнить
    про это место.
    """
    sub = db.get(Subscription, user.telegram_id)
    return sub is not None and sub.status == "active" and sub.tier in FREE_TEXT_TIERS


@router.post("/spreads/{spread_record_id}/follow-up", response_model=FollowUpResponse)
async def ask_follow_up(
    spread_record_id: int,
    body: FollowUpRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowUpResponse:
    """
    Answers one follow-up question in the context of the spread's
    already-unlocked interpretation — either one of the preset
    FOLLOW_UP_QUESTIONS, or (on «Премиум»/«Магистр» only) any free-text question
    via body.custom_question. Each preset question is billed once per
    spread via require_quota() and cached afterward, so re-opening the
    spread later doesn't re-bill or re-call the AI for the same
    question; custom questions are always freshly billed and never
    deduped, since there's no meaningful notion of "the same" free-text
    question being asked twice.
    """
    record = db.get(SpreadRecord, spread_record_id)
    if record is None or record.user_id != user.telegram_id:
        raise HTTPException(status_code=404, detail="Spread not found")

    if not record.unlocked:
        # Ответ строится по картам расклада и неизбежно их описывает —
        # без этой проверки уточняющий вопрос стал бы способом узнать
        # расклад, не разблокировав его.
        raise HTTPException(status_code=402, detail="Сначала откройте расклад.")

    custom_question = (body.custom_question or "").strip()
    if custom_question:
        if not _can_ask_free_text(db, user) and not settings.skip_payment_check:
            raise HTTPException(
                status_code=403,
                detail="Свои вопросы к раскладу доступны на тарифах «Премиум» и «Магистр».",
            )
        # Свободный текст проходит ту же проверку, что и вопрос к
        # раскладу — иначе ограничения обходились бы через этот путь.
        ensure_question_allowed(custom_question)
        question_label = custom_question[:300]
        # Unique per submission — see docstring: custom questions are
        # never looked up/deduped, so this only needs to avoid colliding
        # with the UniqueConstraint("spread_record_id", "question_key"),
        # not to be a meaningful cache key.
        question_key = f"custom-{uuid.uuid4().hex[:8]}"
        existing = None
    else:
        question_label = FOLLOW_UP_QUESTIONS.get(body.question_key or "")
        if question_label is None:
            raise HTTPException(status_code=400, detail="Unknown question")
        question_key = body.question_key
        existing = db.execute(
            select(SpreadFollowUp).where(
                SpreadFollowUp.spread_record_id == spread_record_id,
                SpreadFollowUp.question_key == question_key,
            )
        ).scalar_one_or_none()
    if existing is not None:
        return FollowUpResponse(question_key=question_key, question_label=question_label, answer=existing.answer)

    # Not requiring record.interpretation to be set: the frontend only
    # ever shows these questions once an interpretation has been shown
    # to the user, but that text isn't persisted here when it was itself
    # a fallback (AI unavailable — see interpret_spread's "only persist
    # a real AI result" comment). Hard-requiring the DB value would 400
    # with a confusing "unlock the interpretation first" error in that
    # case, right after the user did exactly that. record.interpretation
    # is used below as optional context, not a precondition.

    require_quota(db, user)

    cards = json.loads(record.cards_json)
    card_lines = "\n".join(
        f"- {c['position_label']}: {c['name']}"
        f"{' (перевёрнутая)' if c['is_reversed'] else ''}"
        for c in cards
    )
    interpretation_line = (
        f"Толкование расклада: {record.interpretation}\n\n" if record.interpretation else ""
    )

    generated = await generate_text(
        system_prompt=(
            "Ты — тёплый и внятный толкователь таро, отвечающий на один "
            "уточняющий вопрос по уже сделанному раскладу. Дай связный "
            "ответ на русском языке, 60-100 слов, обычным текстом без "
            "заголовков и списков, опираясь на карты расклада (и уже данное "
            "толкование, если оно приведено). Не давай медицинских, "
            "юридических или финансовых советов, не утверждай ничего как "
            "гарантированный факт о будущем. Закончи текст полным "
            "завершающим предложением."
        ),
        user_prompt=(
            f"Расклад «{record.spread_title}»:\n{card_lines}\n\n"
            f"{interpretation_line}"
            f"Уточняющий вопрос: {question_label}"
        ),
        max_tokens=250,
    )
    answer = generated or (
        "Ответ на уточняющий вопрос сейчас недоступен (не настроен ключ AI-сервиса "
        "на сервере) — опирайтесь на уже данное толкование расклада."
    )

    # Same rationale as interpret_spread: only persist a real AI result,
    # so a transient provider outage doesn't permanently strand this
    # question behind generic fallback text.
    if generated:
        db.add(
            SpreadFollowUp(
                spread_record_id=spread_record_id,
                question_key=question_key,
                question_label=question_label,
                answer=answer,
            )
        )
        db.commit()
    return FollowUpResponse(question_key=question_key, question_label=question_label, answer=answer)
