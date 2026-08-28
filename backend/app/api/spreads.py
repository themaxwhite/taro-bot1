import datetime as dt
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.subscriptions import require_quota
from app.db import get_db
from app.moderation import ensure_question_allowed
from app.models import SpreadRecord, User
from app.spreads import SPREADS, SpreadId
from app.tarot.engine import tarot_engine
from app.tarot.schemas import DrawnCard, DrawSpreadRequest, DrawSpreadResponse
from app.tarot.visibility import card_count, stored_cards, visible_cards

router = APIRouter(prefix="/api/spreads", tags=["spreads"])


DAILY_CARD_COOLDOWN = dt.timedelta(hours=24)


def _as_utc(naive: dt.datetime) -> dt.datetime:
    """
    The rest of the app stores naive UTC datetimes (see models.py), which
    Pydantic serializes to JSON with no timezone suffix — `new Date(...)`
    on the frontend then parses that string as *local* time, silently
    shifting a countdown target by the browser's UTC offset. Label it as
    UTC before it leaves the process so the ISO string carries `+00:00`.
    """
    return naive.replace(tzinfo=dt.timezone.utc)


def _current_daily_card(db: Session, user_id: int) -> SpreadRecord | None:
    """
    "Карта дня" stays the same for a rolling 24 hours from when it was
    drawn (not a calendar-day reset) — so before drawing, check whether
    this user's most recent daily-card record is still within its
    cooldown window.
    """
    stmt = (
        select(SpreadRecord)
        .where(
            SpreadRecord.user_id == user_id,
            SpreadRecord.spread_id == SpreadId.DAILY_CARD.value,
        )
        .order_by(SpreadRecord.created_at.desc())
    )
    latest = db.execute(stmt).scalars().first()
    if latest is not None and dt.datetime.utcnow() - latest.created_at < DAILY_CARD_COOLDOWN:
        return latest
    return None


class DailyCardStatusResponse(BaseModel):
    next_available_at: dt.datetime | None


@router.get("/daily-card/status", response_model=DailyCardStatusResponse)
def get_daily_card_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DailyCardStatusResponse:
    """
    Read-only check for MainScreen's banner — unlike POST /draw, this
    never creates a record, so it can't accidentally reveal today's card
    before the user actually taps through the deck-selection ritual.
    Returns null until they've drawn at least once today (or in the last
    24h, technically — see _current_daily_card).
    """
    existing = _current_daily_card(db, user.telegram_id)
    next_available_at = _as_utc(existing.created_at + DAILY_CARD_COOLDOWN) if existing else None
    return DailyCardStatusResponse(next_available_at=next_available_at)


class CheckQuestionRequest(BaseModel):
    question: str


@router.post("/check-question")
def check_question(body: CheckQuestionRequest) -> dict:
    """
    Прогоняет вопрос через те же ограничения, что и розыгрыш.

    Существует ради того, чтобы отказ показывался под полем ввода, а не
    после того, как человек уже вытянул карты: сам розыгрыш происходит
    на следующем экране, и 400 оттуда прилетал бы в момент, когда
    исправить вопрос уже негде. На проверку в /draw это не влияет — она
    остаётся главной, а эта лишь предупреждает заранее.
    """
    ensure_question_allowed(body.question)
    return {"ok": True}


@router.post("/draw", response_model=DrawSpreadResponse)
def draw_spread(
    request: DrawSpreadRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DrawSpreadResponse:
    if request.spread_id not in SPREADS:
        # Defensive — SpreadId enum already constrains valid values, but
        # this guards against SPREADS/enum drifting out of sync.
        raise HTTPException(status_code=400, detail="Unknown spread_id")

    is_daily_card = request.spread_id == SpreadId.DAILY_CARD

    if is_daily_card:
        existing = _current_daily_card(db, user.telegram_id)
        if existing is not None:
            return DrawSpreadResponse(
                id=existing.id,
                spread_id=request.spread_id,
                cards=visible_cards(existing),
                unlocked=existing.unlocked,
                card_count=card_count(existing),
                next_available_at=_as_utc(existing.created_at + DAILY_CARD_COOLDOWN),
            )

    if request.question:
        # Проверяем до розыгрыша: иначе запрещённый вопрос успел бы
        # создать запись и сжечь суточный лимит карты дня.
        ensure_question_allowed(request.question)

    cards = tarot_engine.draw(request.spread_id)

    record = SpreadRecord(
        user_id=user.telegram_id,
        spread_id=request.spread_id.value,
        spread_title=SPREADS[request.spread_id].title,
        cards_json=json.dumps([c.model_dump(mode="json") for c in cards]),
        question=request.question,
        # Карта дня — единственный бесплатный расклад, она открыта сразу.
        # Всё остальное ждёт разблокировки (api/ai.py::interpret_spread).
        unlocked=is_daily_card,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    next_available_at = _as_utc(record.created_at + DAILY_CARD_COOLDOWN) if is_daily_card else None
    return DrawSpreadResponse(
        id=record.id,
        spread_id=request.spread_id,
        cards=visible_cards(record),
        unlocked=record.unlocked,
        card_count=len(cards),
        next_available_at=next_available_at,
    )


@router.post("/{spread_record_id}/draw-extra", response_model=DrawSpreadResponse)
def draw_extra_card(
    spread_record_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DrawSpreadResponse:
    """
    Pulls one additional card onto an existing spread — the paid
    "вытянуть ещё карту" feature. Each call consumes one unit of the
    user's subscription quota (see api/subscriptions.py::require_quota).
    """
    record = db.get(SpreadRecord, spread_record_id)
    if record is None or record.user_id != user.telegram_id:
        raise HTTPException(status_code=404, detail="Spread not found")

    if record.spread_id == SpreadId.DAILY_CARD.value:
        # Карта дня — ровно одна карта в сутки, в этом весь её смысл.
        raise HTTPException(status_code=400, detail="К карте дня нельзя вытянуть дополнительную карту.")

    if not record.unlocked:
        # Иначе можно было бы увидеть расклад по частям, доплачивая за
        # «дополнительную» карту вместо разблокировки самого расклада.
        raise HTTPException(status_code=402, detail="Сначала откройте расклад.")

    require_quota(db, user)

    cards = stored_cards(record)

    extra = tarot_engine.draw_one_more(
        position=len(cards),
        position_label="Дополнительная карта",
        exclude_card_ids={c.card_id for c in cards},
    )
    cards.append(extra)

    record.cards_json = json.dumps([c.model_dump(mode="json") for c in cards])
    # Adding a card invalidates any previously generated interpretation —
    # it was written for the old, shorter set of cards.
    record.interpretation = None
    db.commit()

    return DrawSpreadResponse(
        id=record.id,
        spread_id=SpreadId(record.spread_id),
        cards=cards,
        unlocked=True,
        card_count=len(cards),
    )
