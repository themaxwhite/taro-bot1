import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.api.subscriptions import available_unlocks
from app.energy import CHAT_QUESTION_COST
from app.subscriptions import TIERS
from app.models import ChatMessage, SpreadRecord, Subscription, SubscriptionPayment, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    """
    Gates the whole admin router on `ADMIN_TELEGRAM_IDS` — the app
    owner's own account(s), not a general role system. A regular user
    hitting these endpoints (or the frontend screen calling them) just
    gets a 403, same as any other unauthorized request.
    """
    if user.telegram_id not in settings.admin_telegram_id_set:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


class AdminStatsResponse(BaseModel):
    users_total: int
    users_new_today: int
    users_new_7d: int
    active_today: int
    spreads_total: int
    spreads_today: int
    # Счётчик по каждому тарифу, а не пара фиксированных полей: тарифы
    # добавляются и снимаются с продажи, и захардкоженные поля пришлось
    # бы править здесь, во фронтенде и в маппинге при каждом изменении —
    # а пока не поправишь, новый тариф просто не виден в статистике.
    active_subscriptions: dict[str, int]
    revenue_total_rub: int
    revenue_7d_rub: int
    referrals_total: int


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminStatsResponse:
    now = dt.datetime.utcnow()
    today_start = dt.datetime.combine(now.date(), dt.time.min)
    week_start = today_start - dt.timedelta(days=7)

    users_total = db.execute(select(func.count()).select_from(User)).scalar_one()
    users_new_today = db.execute(
        select(func.count()).select_from(User).where(User.created_at >= today_start)
    ).scalar_one()
    users_new_7d = db.execute(
        select(func.count()).select_from(User).where(User.created_at >= week_start)
    ).scalar_one()
    referrals_total = db.execute(
        select(func.count()).select_from(User).where(User.referred_by.is_not(None))
    ).scalar_one()

    spreads_total = db.execute(select(func.count()).select_from(SpreadRecord)).scalar_one()
    spreads_today = db.execute(
        select(func.count()).select_from(SpreadRecord).where(SpreadRecord.created_at >= today_start)
    ).scalar_one()
    # Proxy for "active today" — there's no separate last-seen column on
    # User, but drawing a spread is the app's core action, so distinct
    # users who did that today is a reasonable stand-in for DAU.
    active_today = db.execute(
        select(func.count(func.distinct(SpreadRecord.user_id))).where(SpreadRecord.created_at >= today_start)
    ).scalar_one()

    # Группируем по тому, что реально лежит в базе, — так в статистику
    # попадают и снятые с продажи тарифы с действующими подписчиками, и
    # админский промо-доступ.
    active_by_tier = dict(
        db.execute(
            select(Subscription.tier, func.count())
            .where(Subscription.status == "active", Subscription.period_end >= now)
            .group_by(Subscription.tier)
        ).all()
    )
    active_subscriptions = {
        tier.id.value: active_by_tier.get(tier.id.value, 0) for tier in TIERS.values()
    }
    # Тарифы, которых нет в конфиге (например "admin"), иначе потерялись бы.
    for tier_name, count in active_by_tier.items():
        active_subscriptions.setdefault(tier_name, count)

    revenue_total = db.execute(
        select(func.coalesce(func.sum(SubscriptionPayment.amount_rub), 0)).where(
            SubscriptionPayment.status == "succeeded"
        )
    ).scalar_one()
    revenue_7d = db.execute(
        select(func.coalesce(func.sum(SubscriptionPayment.amount_rub), 0)).where(
            SubscriptionPayment.status == "succeeded",
            SubscriptionPayment.created_at >= week_start,
        )
    ).scalar_one()

    return AdminStatsResponse(
        users_total=users_total,
        users_new_today=users_new_today,
        users_new_7d=users_new_7d,
        active_today=active_today,
        spreads_total=spreads_total,
        spreads_today=spreads_today,
        active_subscriptions=active_subscriptions,
        revenue_total_rub=revenue_total,
        revenue_7d_rub=revenue_7d,
        referrals_total=referrals_total,
    )


# --- Карточка пользователя для поддержки --------------------------------
#
# Отвечает на вопрос «у кого что пошло не так»: заплатил и не получил,
# пропала энергия, не открылся расклад.
#
# Ограничение, из которого следует форма ответа: журнала операций с
# энергией в базе нет. Хранятся текущие остатки, а сами списания нигде не
# фиксируются. Поэтому «операции» здесь — не бухгалтерская книга, а
# перечень событий, которые реально записаны: платежи, расклады,
# уточняющие вопросы и вопросы в чат. По ним видно, что человек делал и
# за что платил, но восстановить, из чего сложился текущий остаток, эти
# данные не позволяют. Понадобится такое — это отдельная таблица
# проводок, а не доработка этого экрана.


class AdminUserBrief(BaseModel):
    telegram_id: int
    first_name: str
    username: str | None
    created_at: dt.datetime
    spreads_total: int


class AdminPayment(BaseModel):
    created_at: dt.datetime
    kind: str
    tier: str
    energy_amount: int
    amount_rub: int
    status: str
    yookassa_payment_id: str


class AdminEvent(BaseModel):
    """Оплачиваемое действие в ленте активности."""

    created_at: dt.datetime
    kind: str  # spread | follow-up | chat
    title: str
    # Стоимость по нынешним правилам. Именно по нынешним: цена могла
    # меняться, а история цен не хранится.
    cost: int
    detail: str | None = None


class AdminUserDetail(BaseModel):
    telegram_id: int
    first_name: str
    username: str | None
    created_at: dt.datetime
    gender: str | None
    zodiac_sign: str | None
    patron_card: str | None
    notifications_enabled: bool
    referred_by: int | None
    referrals_count: int

    energy_daily: int
    energy_refreshed_date: str | None
    energy_purchased: int
    energy_referral: int
    energy_total: int

    subscription_tier: str | None
    subscription_status: str | None
    subscription_quota_total: int | None
    subscription_quota_used: int | None
    subscription_period_end: dt.datetime | None

    spreads_total: int
    chat_questions: int
    payments: list[AdminPayment]
    events: list[AdminEvent]


@router.get("/users", response_model=list[AdminUserBrief])
def search_users(
    q: str,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserBrief]:
    """
    Поиск по id, имени или username.

    В поддержку обращаются по-разному: кто-то называет @username, кто-то
    только имя, а числовой id знает лишь тот, кто уже смотрел логи.
    Поэтому строка проверяется и как число, и как часть имени.
    """
    query = q.strip()
    if not query:
        return []

    conditions = [
        User.first_name.ilike(f"%{query}%"),
        User.username.ilike(f"%{query}%"),
    ]
    if query.lstrip("-").isdigit():
        conditions.append(User.telegram_id == int(query))

    users = (
        db.execute(select(User).where(or_(*conditions)).order_by(User.created_at.desc()).limit(20))
        .scalars()
        .all()
    )

    return [
        AdminUserBrief(
            telegram_id=u.telegram_id,
            first_name=u.first_name,
            username=u.username,
            created_at=u.created_at,
            spreads_total=db.execute(
                select(func.count())
                .select_from(SpreadRecord)
                .where(SpreadRecord.user_id == u.telegram_id)
            ).scalar_one(),
        )
        for u in users
    ]


@router.get("/users/{telegram_id}", response_model=AdminUserDetail)
def get_user_detail(
    telegram_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    user = db.get(User, telegram_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    sub = db.get(Subscription, telegram_id)

    payments = (
        db.execute(
            select(SubscriptionPayment)
            .where(SubscriptionPayment.user_id == telegram_id)
            .order_by(SubscriptionPayment.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )

    spreads = (
        db.execute(
            select(SpreadRecord)
            .where(SpreadRecord.user_id == telegram_id)
            .order_by(SpreadRecord.created_at.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )

    chat_questions = (
        db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == telegram_id, ChatMessage.role == "user")
            .order_by(ChatMessage.id.desc())
            .limit(40)
        )
        .scalars()
        .all()
    )

    events: list[AdminEvent] = []
    for record in spreads:
        events.append(
            AdminEvent(
                created_at=record.created_at,
                kind="spread",
                title=record.spread_title,
                # Неоткрытый расклад ничего не стоил: карты вытянуты, а
                # разблокировка не оплачена. Частый повод обращения —
                # «я разложил, а толкования нет».
                cost=1 if record.unlocked else 0,
                detail=None if record.unlocked else "не открыт",
            )
        )
    for message in chat_questions:
        events.append(
            AdminEvent(
                created_at=message.created_at,
                kind="chat",
                title="Вопрос тарологу",
                cost=CHAT_QUESTION_COST,
                detail=message.text[:120],
            )
        )
    events.sort(key=lambda e: e.created_at, reverse=True)

    return AdminUserDetail(
        telegram_id=user.telegram_id,
        first_name=user.first_name,
        username=user.username,
        created_at=user.created_at,
        gender=user.gender,
        zodiac_sign=user.zodiac_sign,
        patron_card=user.patron_card,
        notifications_enabled=user.notifications_enabled,
        referred_by=user.referred_by,
        referrals_count=db.execute(
            select(func.count()).select_from(User).where(User.referred_by == telegram_id)
        ).scalar_one(),
        energy_daily=user.energy,
        energy_refreshed_date=user.energy_refreshed_date,
        energy_purchased=user.purchased_energy,
        energy_referral=user.referral_bonus_quota,
        energy_total=available_unlocks(db, user),
        subscription_tier=sub.tier if sub else None,
        subscription_status=sub.status if sub else None,
        subscription_quota_total=sub.quota_total if sub else None,
        subscription_quota_used=sub.quota_used if sub else None,
        subscription_period_end=sub.period_end if sub else None,
        spreads_total=db.execute(
            select(func.count()).select_from(SpreadRecord).where(SpreadRecord.user_id == telegram_id)
        ).scalar_one(),
        chat_questions=db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(ChatMessage.user_id == telegram_id, ChatMessage.role == "user")
        ).scalar_one(),
        payments=[
            AdminPayment(
                created_at=p.created_at,
                kind=p.kind,
                tier=p.tier,
                energy_amount=p.energy_amount,
                amount_rub=p.amount_rub,
                status=p.status,
                yookassa_payment_id=p.yookassa_payment_id,
            )
            for p in payments
        ],
        events=events[:60],
    )
