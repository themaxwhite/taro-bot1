import datetime as dt
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.subscriptions import require_quota
from app.db import get_db
from app.models import SpreadRecord, User
from app.spreads import SPREADS, SpreadId
from app.tarot.engine import tarot_engine
from app.tarot.schemas import DrawnCard, DrawSpreadRequest, DrawSpreadResponse

router = APIRouter(prefix="/api/spreads", tags=["spreads"])


def _todays_daily_card(db: Session, user_id: int) -> SpreadRecord | None:
    """
    "Карта дня" should be the same card for the whole day, not a fresh
    random draw on every request — so before drawing, check whether this
    user already has a daily-card record created today (UTC).
    """
    start_of_day = dt.datetime.combine(dt.datetime.utcnow().date(), dt.time.min)
    stmt = (
        select(SpreadRecord)
        .where(
            SpreadRecord.user_id == user_id,
            SpreadRecord.spread_id == SpreadId.DAILY_CARD.value,
            SpreadRecord.created_at >= start_of_day,
        )
        .order_by(SpreadRecord.created_at.desc())
    )
    return db.execute(stmt).scalars().first()


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

    if request.spread_id == SpreadId.DAILY_CARD:
        existing = _todays_daily_card(db, user.telegram_id)
        if existing is not None:
            cards = [DrawnCard.model_validate(c) for c in json.loads(existing.cards_json)]
            return DrawSpreadResponse(id=existing.id, spread_id=request.spread_id, cards=cards)

    cards = tarot_engine.draw(request.spread_id)

    record = SpreadRecord(
        user_id=user.telegram_id,
        spread_id=request.spread_id.value,
        spread_title=SPREADS[request.spread_id].title,
        cards_json=json.dumps([c.model_dump(mode="json") for c in cards]),
        question=request.question,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return DrawSpreadResponse(id=record.id, spread_id=request.spread_id, cards=cards)


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

    require_quota(db, user)

    cards = [DrawnCard.model_validate(c) for c in json.loads(record.cards_json)]

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

    return DrawSpreadResponse(id=record.id, spread_id=SpreadId(record.spread_id), cards=cards)
