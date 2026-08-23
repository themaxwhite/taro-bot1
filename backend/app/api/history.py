import datetime as dt
import json
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db import get_db
from app.history.schemas import HistoryEntry, ProfileStats
from app.models import SpreadRecord, User
from app.tarot.schemas import DrawnCard

router = APIRouter(prefix="/api", tags=["history"])


def _record_to_entry(record: SpreadRecord) -> HistoryEntry:
    cards = [DrawnCard.model_validate(c) for c in json.loads(record.cards_json)]
    return HistoryEntry(
        id=record.id,
        spread_id=record.spread_id,
        spread_title=record.spread_title,
        completed_at=record.created_at,
        cards=cards,
        question=record.question,
        interpretation=record.interpretation,
    )


def _days_streak(db: Session, user_id: int) -> int:
    """
    Consecutive-day streak, Duolingo-style: counts back from today (or
    yesterday, so the streak survives until the day actually lapses)
    through unbroken calendar days that have at least one spread.
    """
    stmt = (
        select(SpreadRecord.created_at)
        .where(SpreadRecord.user_id == user_id)
        .order_by(SpreadRecord.created_at.desc())
    )
    timestamps = db.execute(stmt).scalars().all()
    if not timestamps:
        return 0

    distinct_days = sorted({ts.date() for ts in timestamps}, reverse=True)
    today = dt.datetime.utcnow().date()

    if (today - distinct_days[0]).days > 1:
        return 0  # most recent spread was more than a day ago — streak's over

    streak = 1
    cursor = distinct_days[0]
    for day in distinct_days[1:]:
        if cursor - day == dt.timedelta(days=1):
            streak += 1
            cursor = day
        else:
            break
    return streak


@router.get("/history", response_model=list[HistoryEntry])
def get_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HistoryEntry]:
    stmt = (
        select(SpreadRecord)
        .where(SpreadRecord.user_id == user.telegram_id)
        .order_by(SpreadRecord.created_at.desc())
    )
    records = db.execute(stmt).scalars().all()
    return [_record_to_entry(r) for r in records]


@router.get("/profile/stats", response_model=ProfileStats)
def get_profile_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileStats:
    total_count = len(
        db.execute(
            select(SpreadRecord.id).where(SpreadRecord.user_id == user.telegram_id)
        ).all()
    )
    return ProfileStats(total_spreads=total_count, days_streak=_days_streak(db, user.telegram_id))


class UpdateInterestsRequest(BaseModel):
    interests: str = Field(default="", max_length=500)


class UpdateNotificationsRequest(BaseModel):
    enabled: bool


Gender = Literal["male", "female"]
ZodiacSign = Literal[
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
]


class CompleteOnboardingRequest(BaseModel):
    gender: Gender
    zodiac_sign: ZodiacSign


class ProfileResponse(BaseModel):
    first_name: str
    username: str | None
    interests: str | None
    notifications_enabled: bool
    gender: str | None
    zodiac_sign: str | None


def _profile_response(user: User) -> ProfileResponse:
    return ProfileResponse(
        first_name=user.first_name,
        username=user.username,
        interests=user.interests,
        notifications_enabled=user.notifications_enabled,
        gender=user.gender,
        zodiac_sign=user.zodiac_sign,
    )


@router.get("/profile", response_model=ProfileResponse)
def get_profile(user: User = Depends(get_current_user)) -> ProfileResponse:
    return _profile_response(user)


@router.patch("/profile/interests", response_model=ProfileResponse)
def update_interests(
    body: UpdateInterestsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Free-form topics ("отношения, карьера, переезд") fed into the AI
    interpretation prompt (see app/api/ai.py) so a paid reading can lean
    into what the person actually cares about, not just the cards.
    """
    user.interests = body.interests.strip() or None
    db.commit()
    db.refresh(user)
    return _profile_response(user)


@router.patch("/profile/notifications", response_model=ProfileResponse)
def update_notifications(
    body: UpdateNotificationsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Opts the user in/out of the daily "карта дня" reminder (app/notifications.py)."""
    user.notifications_enabled = body.enabled
    db.commit()
    db.refresh(user)
    return _profile_response(user)


@router.patch("/profile/onboarding", response_model=ProfileResponse)
def complete_onboarding(
    body: CompleteOnboardingRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    The one-time gender + zodiac sign step shown before the main menu
    (see frontend/src/pages/OnboardingScreen). Safe to call again later
    — there's no "locked after first save" behavior, unlike referred_by.
    """
    user.gender = body.gender
    user.zodiac_sign = body.zodiac_sign
    db.commit()
    db.refresh(user)
    return _profile_response(user)
