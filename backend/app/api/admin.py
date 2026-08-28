import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.config import settings
from app.db import get_db
from app.subscriptions import TIERS
from app.models import SpreadRecord, Subscription, SubscriptionPayment, User

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
