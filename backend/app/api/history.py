import datetime as dt
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.tarot.visibility import card_count, visible_cards
from app.history.schemas import FollowUpEntry, HistoryEntry, ProfileStats
from app.models import SpreadRecord, User
from app.streaks import days_streak, next_reward
from app.tarot.cards import MAJOR_ARCANA_IDS
from app.tarot.schemas import DrawnCard

router = APIRouter(prefix="/api", tags=["history"])


def _record_to_entry(record: SpreadRecord) -> HistoryEntry:
    follow_ups = [
        FollowUpEntry(question_key=fu.question_key, question_label=fu.question_label, answer=fu.answer)
        for fu in sorted(record.follow_ups, key=lambda fu: fu.created_at)
    ]
    return HistoryEntry(
        id=record.id,
        spread_id=record.spread_id,
        spread_title=record.spread_title,
        completed_at=record.created_at,
        # Нельзя отдать карты нераскрытого расклада: иначе историю можно
        # было бы использовать как обходной путь мимо разблокировки.
        cards=visible_cards(record),
        unlocked=record.unlocked,
        card_count=card_count(record),
        question=record.question,
        interpretation=record.interpretation,
        follow_ups=follow_ups,
    )


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
    streak = days_streak(db, user.telegram_id)
    upcoming = next_reward(streak, user.streak_reward_day)
    return ProfileStats(
        total_spreads=total_count,
        days_streak=streak,
        next_reward_day=upcoming[0] if upcoming else None,
        next_reward_energy=upcoming[1] if upcoming else None,
    )


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


class UpdateZodiacRequest(BaseModel):
    zodiac_sign: ZodiacSign


class UpdatePatronCardRequest(BaseModel):
    # None — снять выбор. Значение проверяется по колоде, а не по
    # Literal со списком из 22 строк: список карт уже существует в
    # app/tarot/cards.py, и второй его экземпляр разошёлся бы с первым.
    patron_card: str | None


class ProfileResponse(BaseModel):
    first_name: str
    username: str | None
    interests: str | None
    notifications_enabled: bool
    gender: str | None
    zodiac_sign: str | None
    patron_card: str | None
    is_admin: bool


def _profile_response(user: User) -> ProfileResponse:
    return ProfileResponse(
        first_name=user.first_name,
        username=user.username,
        interests=user.interests,
        notifications_enabled=user.notifications_enabled,
        gender=user.gender,
        zodiac_sign=user.zodiac_sign,
        patron_card=user.patron_card,
        is_admin=user.telegram_id in settings.admin_telegram_id_set,
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


@router.patch("/profile/zodiac", response_model=ProfileResponse)
def update_zodiac(
    body: UpdateZodiacRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Смена знака зодиака уже после онбординга — там его выбирают один раз
    и промахнуться легко, а деться от ошибки было некуда.
    """
    user.zodiac_sign = body.zodiac_sign
    db.commit()
    db.refresh(user)
    return _profile_response(user)


@router.patch("/profile/patron-card", response_model=ProfileResponse)
def update_patron_card(
    body: UpdatePatronCardRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """
    Карта-покровитель — один из 22 старших арканов на выбор.

    Проверяется по настоящей колоде: иначе сюда прошёл бы любой текст, и
    фронтенд попросил бы у сервера картинку `/cards/<мусор>.webp`.
    """
    card_id = body.patron_card
    if card_id is not None:
        if card_id not in MAJOR_ARCANA_IDS:
            raise HTTPException(status_code=400, detail="Такой карты нет среди старших арканов.")
    user.patron_card = card_id
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
