import datetime as dt
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.models import Subscription, SubscriptionPayment, User
from app.subscriptions import TIERS, SubscriptionTier
from app.yookassa.client import YooKassaError, create_payment, get_payment
from app.yookassa.client import is_configured as is_yookassa_configured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class CreatePaymentRequest(BaseModel):
    tier: SubscriptionTier


class CreatePaymentResponse(BaseModel):
    confirmation_url: str
    payment_id: str


class SubscriptionStatusResponse(BaseModel):
    tier: str | None
    status: str | None
    quota_total: int | None
    quota_used: int | None
    period_end: dt.datetime | None
    energy_available: bool


class RedeemPromoRequest(BaseModel):
    code: str


class RedeemPromoResponse(BaseModel):
    ok: bool


@router.post("/create-payment", response_model=CreatePaymentResponse)
async def create_subscription_payment(
    body: CreatePaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreatePaymentResponse:
    if not is_yookassa_configured() or not settings.mini_app_url:
        raise HTTPException(status_code=503, detail="Оплата подписки временно недоступна. Попробуйте позже.")

    tier = TIERS[body.tier]
    try:
        payment = await create_payment(
            amount_rub=tier.price_rub,
            description=f"Подписка «{tier.title}» — Tarot Aurum",
            return_url=settings.mini_app_url,
            metadata={"user_id": user.telegram_id, "tier": tier.id.value},
        )
    except YooKassaError:
        logger.exception("Failed to create ЮKassa payment")
        raise HTTPException(status_code=503, detail="Оплата подписки временно недоступна. Попробуйте позже.") from None

    db.add(
        SubscriptionPayment(
            yookassa_payment_id=payment["id"],
            user_id=user.telegram_id,
            tier=tier.id.value,
            amount_rub=tier.price_rub,
            status="pending",
        )
    )
    db.commit()

    return CreatePaymentResponse(
        confirmation_url=payment["confirmation"]["confirmation_url"],
        payment_id=payment["id"],
    )


@router.get("/status", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionStatusResponse:
    _ensure_energy_refreshed(db, user)
    energy_available = user.energy > 0

    sub = db.get(Subscription, user.telegram_id)
    if sub is None:
        return SubscriptionStatusResponse(
            tier=None, status=None, quota_total=None, quota_used=None, period_end=None, energy_available=energy_available
        )
    _expire_if_due(db, sub)
    return SubscriptionStatusResponse(
        tier=sub.tier,
        status=sub.status,
        quota_total=sub.quota_total,
        quota_used=sub.quota_used,
        period_end=sub.period_end,
        energy_available=energy_available,
    )


@router.post("/webhook")
async def subscription_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    ЮKassa calls this on payment status changes (configure the URL once
    in the merchant dashboard — see DEPLOYMENT.md). The notification body
    itself is never trusted for the payment status: ЮKassa doesn't sign
    webhook payloads, so this only uses the body to learn *which* payment
    to re-check, then asks the ЮKassa API directly for the real status.
    """
    body = await request.json()
    payment_id = (body.get("object") or {}).get("id")
    if not payment_id:
        return {"ok": True}

    record = db.query(SubscriptionPayment).filter_by(yookassa_payment_id=payment_id).one_or_none()
    if record is None or record.status != "pending":
        return {"ok": True}

    try:
        payment = await get_payment(payment_id)
    except YooKassaError:
        logger.exception("Failed to verify ЮKassa payment %s", payment_id)
        return {"ok": True}

    if payment.get("status") == "succeeded":
        record.status = "succeeded"
        tier = TIERS[SubscriptionTier(record.tier)]
        _activate_subscription(db, record.user_id, tier=tier.id.value, quota_total=tier.monthly_quota, days=30)
    elif payment.get("status") in ("canceled", "expired"):
        record.status = "canceled"
        db.commit()

    return {"ok": True}


@router.post("/redeem-promo", response_model=RedeemPromoResponse)
def redeem_promo(
    body: RedeemPromoRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedeemPromoResponse:
    """
    A single admin/testing code (ADMIN_PROMO_CODE) that grants full
    access without going through ЮKassa — meant for the app's own owner
    to test paid features inside real Telegram before a merchant account
    exists. Not a general discount-code system.
    """
    if not settings.admin_promo_code or body.code.strip() != settings.admin_promo_code:
        raise HTTPException(status_code=400, detail="Неверный промокод")

    _activate_subscription(db, user.telegram_id, tier="admin", quota_total=999_999, days=365)
    return RedeemPromoResponse(ok=True)


def _activate_subscription(db: Session, user_id: int, *, tier: str, quota_total: int, days: int) -> None:
    sub = db.get(Subscription, user_id)
    if sub is None:
        sub = Subscription(user_id=user_id)
        db.add(sub)
    sub.tier = tier
    sub.status = "active"
    sub.quota_total = quota_total
    sub.quota_used = 0
    sub.period_end = dt.datetime.utcnow() + dt.timedelta(days=days)
    db.commit()


def _expire_if_due(db: Session, sub: Subscription) -> None:
    if sub.status == "active" and sub.period_end < dt.datetime.utcnow():
        sub.status = "expired"
        db.commit()


# Free daily allowance, refilled once per calendar day (UTC) and not
# carried over — deliberately well below even the Базовый tier's
# effective daily rate (10/month ≈ 0.33/day) so it reads as a "come
# back tomorrow" hook, not a substitute for subscribing. Spent before
# referral_bonus_quota (which persists) and before a paid subscription,
# since it's wasted if not used today anyway.
DAILY_FREE_ENERGY = 1


def _ensure_energy_refreshed(db: Session, user: User) -> None:
    today = dt.datetime.utcnow().date().isoformat()
    if user.energy_refreshed_date != today:
        user.energy = DAILY_FREE_ENERGY
        user.energy_refreshed_date = today
        db.commit()


def require_quota(db: Session, user: User) -> None:
    """
    Raises 402 unless the user has quota left, otherwise consumes one
    unit. Shared by every paid unlock (spread interpretation, extra
    card, a follow-up question) — each "unlock" costs one unit
    regardless of which feature it is. Spending order: free daily
    energy first, then referral bonus quota (app/api/referral.py),
    then a paid subscription — so inviting friends and just opening the
    app are both worth something even without one.
    """
    if settings.skip_payment_check:
        return

    _ensure_energy_refreshed(db, user)
    if user.energy > 0:
        user.energy -= 1
        db.commit()
        return

    if user.referral_bonus_quota > 0:
        user.referral_bonus_quota -= 1
        db.commit()
        return

    sub = db.get(Subscription, user.telegram_id)
    if sub is None:
        raise HTTPException(status_code=402, detail="Нужна подписка, чтобы открыть эту функцию.")

    _expire_if_due(db, sub)
    if sub.status != "active":
        raise HTTPException(status_code=402, detail="Подписка истекла. Оформите новую, чтобы продолжить.")
    if sub.quota_used >= sub.quota_total:
        raise HTTPException(status_code=402, detail="Лимит подписки на этот месяц исчерпан.")

    sub.quota_used += 1
    db.commit()
