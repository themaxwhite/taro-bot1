"""
Тарифы, энергия и квоты — всё, кроме собственно приёма денег.

Платёжный провайдер сейчас не подключён: ни ЮKassa, ни FreeKassa, ни
какого-либо другого. Соответственно здесь нет ни создания платежа, ни
вебхука о его подтверждении — эндпойнты удалены целиком, а не оставлены
отвечать ошибкой, чтобы не делать вид, что оплата вот-вот заработает.

Всё остальное живо и осмысленно без них. Квоту выдаёт промокод
(ADMIN_PROMO_CODE), энергия начисляется посуточно и за приглашённых
друзей, `require_quota` тратит её в прежнем порядке. Витрина тарифов
(`/tiers`) и пакетов (`/energy-packs`) тоже осталась: это описание
продукта, а не кнопка оплаты, и фронтенд рисует по ней карточки без
возможности купить.

Когда провайдер появится, ему нужны будут ровно три вещи: эндпойнт,
создающий строку `SubscriptionPayment` в статусе pending, обработчик его
подтверждения, и вызов `_activate_subscription` (для подписки) либо
прибавление к `User.purchased_energy` (для пакета) в момент, когда
оплата подтвердилась. Модель платежа (`app/models.py`) для этого уже
готова и от конкретной платёжки не зависит.
"""

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.ratelimit import check_rate_limit
from app.models import Subscription, User
from app.energy import DAILY_FREE_ENERGY, ENERGY_PACKS
from app.subscriptions import TIERS, SubscriptionTier, purchasable_tiers

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])


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


class RedeemPromoRequest(BaseModel):
    code: str


class RedeemPromoResponse(BaseModel):
    ok: bool


@router.get("/tiers", response_model=list[TierResponse])
def list_tiers() -> list[TierResponse]:
    """
    Тарифы, доступные к покупке — снятые с продажи сюда не попадают.

    Витрину отдаёт backend, а не хардкод на фронтенде: иначе цена на
    экране и цена, по которой реально выставляется счёт, разъезжаются
    ровно в тот момент, когда их меняют. Купить прямо сейчас нельзя —
    платёжный провайдер не подключён, — но список остаётся описанием
    продукта и источником цен, и им же будет, когда оплата вернётся.
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


@router.get("/status", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionStatusResponse:
    _ensure_energy_refreshed(db, user)
    balance = available_unlocks(db, user)
    common = {
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


@router.post("/redeem-promo", response_model=RedeemPromoResponse)
def redeem_promo(
    body: RedeemPromoRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedeemPromoResponse:
    """
    A single admin/testing code (ADMIN_PROMO_CODE) that grants full
    access. Not a general discount-code system.

    With no payment provider connected this is currently the *only* way
    to get a subscription quota at all, which makes it worth saying
    plainly: anyone who learns the code gets a year of full access. Keep
    it unset in any deployment where that matters.

    Отсюда же и ограничение частоты: эндпойнт открыт любому владельцу
    аккаунта Telegram и проверяет секрет сравнением, то есть в чистом виде
    приглашает к перебору. Пять попыток в час на пользователя оставляют
    запас тому, кто просто опечатался, и делают перебор бессмысленным.
    """
    check_rate_limit("redeem-promo", user.telegram_id, limit=5, window_seconds=3600)

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


def _lock_user(db: Session, user: User) -> None:
    """
    Берёт строку пользователя на замок до конца транзакции и перечитывает
    её вместе с подпиской.

    Без этого проверка баланса и списание — два отдельных шага, между
    которыми успевает вклиниться второй запрос: оба видят «энергия есть»,
    оба получают расклад, а списывается одна единица. Достаточно дважды
    нажать кнопку на медленной сети, так что это не теория.

    Замок берётся на строке пользователя, хотя тратиться может и квота
    подписки: подписка одна на человека, и все списания и без того идут
    через эту функцию — значит строка пользователя годится как общий
    рубеж, а один замок вместо двух не даст запросам встать друг напротив
    друга и заклиниться.

    На SQLite (локальная разработка) блокировок строк нет, и там мы
    просто ничего не делаем: писатель в файловой базе и так один.
    """
    if db.get_bind().dialect.name != "postgresql":
        return

    db.refresh(user, with_for_update=True)
    sub = db.get(Subscription, user.telegram_id)
    if sub is not None:
        # Замок на пользователе, а тратится квота подписки — значит её
        # надо перечитать: в сессии могла остаться цифра, снятая до того,
        # как соседний запрос дошёл до записи.
        db.refresh(sub)


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

    # Просроченную подписку закрываем до замка, а не после: закрытие
    # само по себе фиксирует транзакцию, а фиксация снимает замок. Всё,
    # что коммитит, должно случиться раньше, чем мы его возьмём.
    sub = db.get(Subscription, user.telegram_id)
    if sub is not None:
        _expire_if_due(db, sub)

    _lock_user(db, user)

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
