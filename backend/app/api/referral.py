from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/api/referral", tags=["referral"])


class RegisterReferralRequest(BaseModel):
    referrer_id: int


class RegisterReferralResponse(BaseModel):
    ok: bool


class ReferralStatusResponse(BaseModel):
    referral_link: str | None
    referred_count: int
    bonus_quota: int


@router.post("/register", response_model=RegisterReferralResponse)
def register_referral(
    body: RegisterReferralRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegisterReferralResponse:
    """
    Called once on app mount when Telegram.WebApp.initDataUnsafe.start_param
    is "ref_<id>" (see frontend/src/hooks/useReferralCapture.ts) —
    associates this user with whoever referred them and rewards the
    referrer with one bonus unlock. Idempotent: referred_by is only ever
    set once, so replaying the same start_param on a later app open is a
    harmless no-op rather than a repeated reward.
    """
    if user.referred_by is not None:
        return RegisterReferralResponse(ok=True)
    if body.referrer_id == user.telegram_id:
        raise HTTPException(status_code=400, detail="Нельзя пригласить самого себя")

    referrer = db.get(User, body.referrer_id)
    if referrer is None:
        raise HTTPException(status_code=404, detail="Пригласивший пользователь не найден")

    user.referred_by = referrer.telegram_id
    referrer.referral_bonus_quota += 1
    db.commit()
    return RegisterReferralResponse(ok=True)


@router.get("/status", response_model=ReferralStatusResponse)
def get_referral_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReferralStatusResponse:
    referred_count = db.execute(
        select(func.count()).select_from(User).where(User.referred_by == user.telegram_id)
    ).scalar_one()

    referral_link = None
    if settings.telegram_bot_username and settings.telegram_app_name:
        referral_link = (
            f"https://t.me/{settings.telegram_bot_username}/{settings.telegram_app_name}"
            f"?startapp=ref_{user.telegram_id}"
        )

    return ReferralStatusResponse(
        referral_link=referral_link,
        referred_count=referred_count,
        bonus_quota=user.referral_bonus_quota,
    )
