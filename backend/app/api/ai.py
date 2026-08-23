import datetime as dt
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.client import generate_text
from app.ai.fallback import daily_message_for, fallback_interpretation
from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.models import DailyMessage, Purchase, SpreadRecord, User
from app.spreads import SpreadId

router = APIRouter(prefix="/api", tags=["ai"])


class DailyMessageResponse(BaseModel):
    text: str


class InterpretationResponse(BaseModel):
    interpretation: str


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
    spread. This is the paid "подробное толкование" feature — requires a
    confirmed `Purchase` for this spread (see api/payments.py). Once
    generated, the text is cached on the record so re-opening it later
    (e.g. from History) doesn't re-bill or re-call the AI.
    """
    record = db.get(SpreadRecord, spread_record_id)
    if record is None or record.user_id != user.telegram_id:
        raise HTTPException(status_code=404, detail="Spread not found")

    if record.interpretation:
        return InterpretationResponse(interpretation=record.interpretation)

    # "Карта дня" gets its full interpretation for free — it's the one
    # spread meant as a lightweight daily hook, unlike the paid multi-card
    # readings. Everything else still requires a confirmed Purchase.
    is_daily_card = record.spread_id == SpreadId.DAILY_CARD.value
    if not is_daily_card and not settings.skip_payment_check:
        paid = db.execute(
            select(func.count())
            .select_from(Purchase)
            .where(
                Purchase.spread_record_id == spread_record_id,
                Purchase.product == "interpretation",
                Purchase.status == "paid",
            )
        ).scalar_one()
        if not paid:
            raise HTTPException(status_code=402, detail="Оплата не найдена для этого расклада")

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
            "Ты — тёплый и внятный толкователь таро. Дай связное развёрнутое "
            "толкование расклада на русском языке, 300-400 слов, обычным "
            "текстом без заголовков и списков. Раскрой каждую позицию карты "
            "подробно и то, как карты сочетаются между собой, а не только "
            "каждую карту по отдельности. Если дан вопрос пользователя — "
            "явно свяжи толкование с ним. Не давай медицинских, юридических "
            "или финансовых советов, не утверждай ничего как гарантированный "
            "факт о будущем. Обязательно уложись в объём и закончи текст "
            "полным завершающим предложением — никогда не обрывай мысль "
            "на середине."
        ),
        user_prompt=(
            f"Расклад «{record.spread_title}»:\n{card_lines}\n\n{question_line}\n{interests_line}"
        ),
        max_tokens=2200,
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
    return InterpretationResponse(interpretation=text)
