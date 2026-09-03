import datetime as dt
import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.client import generate_text
from app.ai.fallback import daily_message_for, fallback_interpretation
from app.api.deps import get_current_user
from app.api.subscriptions import available_unlocks, require_quota
from app.config import settings
from app.db import SessionLocal, get_db
from app.tarot.schemas import DrawnCard
from app.tarot.visibility import stored_cards
from app.moderation import ensure_question_allowed
from app.ratelimit import check_ai_rate_limit
from app.models import DailyMessage, SpreadFollowUp, SpreadRecord, Subscription, User
from app.subscriptions import FREE_TEXT_TIERS
from app.spreads import SpreadId

logger = logging.getLogger(__name__)

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


async def ensure_daily_message(db: Session) -> str:
    """
    Фраза дня: одна на всех и одна на сутки, поэтому первый пришедший её
    сочиняет, а остальные читают готовую.

    Всё, что сложнее простого «нет в кэше — сгенерируй», нужно из-за
    смены суток. Приложение дёргает фразу при каждом открытии, и в
    полночь по UTC строки за новый день ещё нет: сколько человек открыло
    приложение в эту минуту, столько обращений к модели и уйдёт, а
    проигравшие гонку за вставку получат нарушение уникальности вместо
    ответа. Поэтому, во-первых, фраза готовится заранее задачей
    планировщика (см. prepare_daily_message ниже) — к утру она уже есть;
    во-вторых, проигравший гонку не падает, а перечитывает чужой
    результат: он ничем не хуже своего.
    """
    key = dt.datetime.utcnow().date().isoformat()

    cached = db.get(DailyMessage, key)
    if cached is not None:
        return cached.text

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
    text = generated or daily_message_for(dt.date.fromisoformat(key).timetuple().tm_yday)

    db.add(DailyMessage(date=key, text=text))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        winner = db.get(DailyMessage, key)
        if winner is not None:
            return winner.text
        raise

    return text


async def prepare_daily_message() -> None:
    """
    Задача планировщика: сочинить фразу вскоре после полуночи UTC, пока
    её ещё никто не спрашивает. К тому часу, когда люди начинают
    открывать приложение, она лежит в базе, и наплыв читает готовое.
    """
    db = SessionLocal()
    try:
        await ensure_daily_message(db)
    except Exception:
        # Не беда: первый же посетитель сочинит фразу сам. Записываем,
        # потому что молча не сработавшая подготовка выглядит как её
        # отсутствие.
        logger.exception("Не удалось подготовить фразу дня заранее")
    finally:
        db.close()


@router.get(
    "/daily-message",
    response_model=DailyMessageResponse,
    # Фраза одна на всех, и раньше ручка была единственной открытой в
    # API. Смотреть в ней нечего, но и держать открытую дверь в закрытом
    # в остальном доме незачем.
    dependencies=[Depends(get_current_user)],
)
async def get_daily_message(db: Session = Depends(get_db)) -> DailyMessageResponse:
    return DailyMessageResponse(text=await ensure_daily_message(db))


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
    check_ai_rate_limit(user.telegram_id)

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

    # Проверяем баланс до обращения к модели, а списываем после удачного
    # ответа. Прежде списание шло первым, и у сбоя провайдера была цена:
    # человек платил и получал статичную заглушку, она намеренно не
    # кэшировалась — и следующая попытка списывала снова. Сбой AI тихо
    # вычерпывал баланс.
    if not is_daily_card and available_unlocks(db, user) < 1:
        raise HTTPException(
            status_code=402,
            detail="Не хватает энергии. Пополните баланс или оформите подписку.",
        )

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
    if generated is None:
        # Карта дня бесплатна — ей заглушка подходит: лучше показать
        # общий текст, чем ничего. За платное толкование брать деньги за
        # заглушку нельзя, поэтому честная ошибка и ноль списаний.
        if not is_daily_card:
            raise HTTPException(
                status_code=503,
                detail="Толкование сейчас не готовится. Попробуйте через минуту — энергия не списана.",
            )
        text = fallback_interpretation([c["name"] for c in cards], record.spread_title)
    else:
        text = generated

    if not is_daily_card:
        require_quota(db, user)

    record.unlocked = True
    # Кэшируем только настоящий ответ модели: заглушка карты дня не
    # должна навсегда занять место толкования.
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
    check_ai_rate_limit(user.telegram_id)

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

    # То же, что и в толковании: баланс проверяем сейчас, списываем
    # после удачного ответа.
    if available_unlocks(db, user) < 1:
        raise HTTPException(
            status_code=402,
            detail="Не хватает энергии. Пополните баланс или оформите подписку.",
        )

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
    if generated is None:
        # Прежде здесь стояла заглушка, которая вдобавок сообщала
        # оплатившему человеку о незаданном ключе на сервере — то есть
        # брала деньги и показывала служебную причину сбоя.
        raise HTTPException(
            status_code=503,
            detail="Ответ сейчас не готовится. Попробуйте через минуту — энергия не списана.",
        )

    answer = generated
    require_quota(db, user)

    # Проверка `if generated` здесь больше не нужна: до этой строки
    # доходит только настоящий ответ, иначе выше поднят 503. Сохраняем
    # безусловно — иначе оплаченный вопрос не попал бы в кэш и следующее
    # открытие расклада списало бы ещё раз.
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
