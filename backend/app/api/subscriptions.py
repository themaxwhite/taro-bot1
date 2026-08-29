import datetime as dt
import logging
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.models import Subscription, SubscriptionPayment, User
from app.energy import DAILY_FREE_ENERGY, ENERGY_PACKS
from app.subscriptions import SUPPORT_CHAT_TIERS, TIERS, SubscriptionTier, purchasable_tiers
from app.freekassa.client import CALLBACK_IPS, FreeKassaError, build_payment_url, verify_callback
from app.freekassa.client import is_configured as is_freekassa_configured

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


class CreatePaymentRequest(BaseModel):
    tier: SubscriptionTier


class CreatePaymentResponse(BaseModel):
    # Имя поля осталось от ЮKassa и специально не менялось: его читает
    # фронтенд (services/subscriptionsApi.ts), а смысл тот же — адрес,
    # куда отправить пользователя платить.
    confirmation_url: str
    # Наш собственный id платежа, он же номер заказа для платёжки.
    payment_id: str


class SubscriptionStatusResponse(BaseModel):
    tier: str | None
    status: str | None
    quota_total: int | None
    quota_used: int | None
    period_end: dt.datetime | None
    energy_available: bool
    # Единый баланс разблокировок, который видит пользователь на главном
    # экране и в профиле — сумма всех источников (см. available_unlocks).
    energy_balance: int
    # Из чего он складывается — для подсказки в профиле.
    energy_daily: int
    # Ёмкость суточной зарядки. Без неё фронтенд не может нарисовать
    # шкалу «сколько из скольких» тем, у кого нет подписки, — а
    # захардкодить константу бэкенда у себя значит разъехаться с ней при
    # первом же изменении.
    energy_daily_max: int
    energy_purchased: int
    energy_referral: int
    # Ссылка на личный чат поддержки — приходит только тем, чей тариф её
    # включает, и только если она вообще настроена. Иначе фронтенд
    # показал бы неработающую кнопку.
    support_chat_url: str | None


class TierResponse(BaseModel):
    id: str
    title: str
    price_rub: int
    monthly_quota: int
    description: str
    badge: str | None
    perks: list[str]


class EnergyPackResponse(BaseModel):
    id: str
    title: str
    amount: int
    price_rub: int
    badge: str | None


class CreateEnergyPaymentRequest(BaseModel):
    pack_id: str


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
    if not tier.purchasable:
        # Тариф снят с продажи: у действующих подписчиков он продолжает
        # работать, но оформить его заново нельзя.
        raise HTTPException(status_code=400, detail="Этот тариф больше не продаётся.")

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


@router.get("/tiers", response_model=list[TierResponse])
def list_tiers() -> list[TierResponse]:
    """
    Тарифы, доступные к покупке — снятые с продажи сюда не попадают.

    Витрину отдаёт backend, а не хардкод на фронтенде: иначе цена на
    экране и цена, по которой реально выставляется счёт, разъезжаются
    ровно в тот момент, когда их меняют.
    """
    return [
        TierResponse(
            id=t.id.value,
            title=t.title,
            price_rub=t.price_rub,
            monthly_quota=t.monthly_quota,
            description=t.description,
            badge=t.badge,
            perks=list(t.perks),
        )
        for t in purchasable_tiers()
    ]


@router.get("/energy-packs", response_model=list[EnergyPackResponse])
def list_energy_packs() -> list[EnergyPackResponse]:
    return [
        EnergyPackResponse(id=p.id, title=p.title, amount=p.amount, price_rub=p.price_rub, badge=p.badge)
        for p in ENERGY_PACKS.values()
    ]


@router.post("/create-energy-payment", response_model=CreatePaymentResponse)
async def create_energy_payment(
    body: CreateEnergyPaymentRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CreatePaymentResponse:
    """
    Same flow as buying a subscription, but what settles is a one-off
    top-up: the webhook credits `energy_amount` to purchased_energy
    instead of starting a billing period.
    """
    pack = ENERGY_PACKS.get(body.pack_id)
    if pack is None:
        raise HTTPException(status_code=400, detail="Неизвестный пакет энергии")

    if not is_yookassa_configured() or not settings.mini_app_url:
        raise HTTPException(status_code=503, detail="Оплата временно недоступна. Попробуйте позже.")

    try:
        payment = await create_payment(
            amount_rub=pack.price_rub,
            description=f"{pack.title} — Tarot Aurum",
            return_url=settings.mini_app_url,
            metadata={"user_id": user.telegram_id, "pack_id": pack.id},
        )
    except YooKassaError:
        logger.exception("Failed to create ЮKassa energy payment")
        raise HTTPException(status_code=503, detail="Оплата временно недоступна. Попробуйте позже.") from None

    db.add(
        SubscriptionPayment(
            yookassa_payment_id=payment["id"],
            user_id=user.telegram_id,
            kind="energy",
            tier="",
            energy_amount=pack.amount,
            amount_rub=pack.price_rub,
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
    balance = available_unlocks(db, user)
    common = {
        "support_chat_url": _support_chat_url(db, user),
        "energy_available": balance > 0,
        "energy_balance": balance,
        "energy_daily": user.energy,
        "energy_daily_max": DAILY_FREE_ENERGY,
        "energy_purchased": user.purchased_energy,
        "energy_referral": user.referral_bonus_quota,
    }

    sub = db.get(Subscription, user.telegram_id)
    if sub is None:
        return SubscriptionStatusResponse(
            tier=None, status=None, quota_total=None, quota_used=None, period_end=None, **common
        )
    _expire_if_due(db, sub)
    return SubscriptionStatusResponse(
        tier=sub.tier,
        status=sub.status,
        quota_total=sub.quota_total,
        quota_used=sub.quota_used,
        period_end=sub.period_end,
        **common,
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
        if record.kind == "energy":
            # Пополнение, а не подписка: просто прибавляем к балансу,
            # который не сгорает.
            buyer = db.get(User, record.user_id)
            if buyer is not None:
                buyer.purchased_energy += record.energy_amount
            db.commit()
        else:
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


def _support_chat_url(db: Session, user: User) -> str | None:
    if not settings.support_chat_url:
        return None
    sub = db.get(Subscription, user.telegram_id)
    if sub is None or sub.status != "active" or sub.tier not in SUPPORT_CHAT_TIERS:
        return None
    return settings.support_chat_url


def _expire_if_due(db: Session, sub: Subscription) -> None:
    if sub.status == "active" and sub.period_end < dt.datetime.utcnow():
        sub.status = "expired"
        db.commit()


def _ensure_energy_refreshed(db: Session, user: User) -> None:
    """
    Tops the free daily grant back up on the first spend of a new UTC day.

    Note this *overwrites* rather than adds: yesterday's unused free
    energy does not carry over. That is also why bought energy lives in
    a separate column (models.py::User.purchased_energy) — putting it
    here would erase someone's purchase at midnight.
    """
    today = dt.datetime.utcnow().date().isoformat()
    if user.energy_refreshed_date != today:
        user.energy = DAILY_FREE_ENERGY
        user.energy_refreshed_date = today
        db.commit()


def available_unlocks(db: Session, user: User) -> int:
    """
    How many unlocks the user could spend right now, across every source.

    Read-only — this is what the balance on the main screen and in the
    profile shows, so it must not have the side effect of refilling the
    daily grant a spend would.
    """
    today = dt.datetime.utcnow().date().isoformat()
    daily = DAILY_FREE_ENERGY if user.energy_refreshed_date != today else user.energy

    subscription = 0
    sub = db.get(Subscription, user.telegram_id)
    if sub is not None:
        _expire_if_due(db, sub)
        if sub.status == "active":
            subscription = max(sub.quota_total - sub.quota_used, 0)

    return daily + subscription + user.referral_bonus_quota + user.purchased_energy


def require_quota(db: Session, user: User, cost: int = 1) -> None:
    """
    Raises 402 unless the user has `cost` unlocks to spend, otherwise
    consumes them. Shared by everything that costs: revealing a spread
    together with its interpretation, an extra card, a follow-up
    question — one unit each — and a question to the tarot reader in
    chat, which costs five.

    The whole cost is checked before a single unit is taken. Spending
    what is there and then failing would leave someone who had three of
    the five with nothing and no answer — charged for a question that
    was never asked.

    Spending order is "whatever expires soonest, first", so nothing is
    wasted by holding it:

      1. the free daily grant   — gone at UTC midnight
      2. subscription quota     — gone at the end of the billing period
      3. referral bonus         — never expires, but it was free
      4. bought energy          — never expires, and it was paid for

    Putting bought energy last is the point of the ordering: someone
    with both a subscription and a pack should burn the subscription
    they are already paying for this month before touching the balance
    they can keep indefinitely.
    """
    if settings.skip_payment_check:
        return

    _ensure_energy_refreshed(db, user)
    if available_unlocks(db, user) < cost:
        raise HTTPException(
            status_code=402,
            detail="Не хватает энергии. Пополните баланс или оформите подписку.",
        )

    remaining = cost

    spent = min(user.energy, remaining)
    user.energy -= spent
    remaining -= spent

    if remaining:
        sub = db.get(Subscription, user.telegram_id)
        if sub is not None and sub.status == "active":
            spent = min(sub.quota_total - sub.quota_used, remaining)
            sub.quota_used += spent
            remaining -= spent

    if remaining:
        spent = min(user.referral_bonus_quota, remaining)
        user.referral_bonus_quota -= spent
        remaining -= spent

    if remaining:
        spent = min(user.purchased_energy, remaining)
        user.purchased_energy -= spent
        remaining -= spent

    # available_unlocks() посчитал те же четыре кармана мгновением
    # раньше, так что остаток здесь невозможен. Проверка — на случай,
    # если однажды карманы разъедутся: молча недосписать оплаченное
    # хуже, чем упасть.
    assert remaining == 0, f"не удалось списать {cost}: осталось {remaining}"

    db.commit()
