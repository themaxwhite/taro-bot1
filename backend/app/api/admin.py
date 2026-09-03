import datetime as dt

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

import logging

from app.api.deps import get_admin_user
from app.db import get_db
from app.api.subscriptions import available_unlocks
from app.energy import CHAT_QUESTION_COST
from app.subscriptions import TIERS
from app.models import (
    ChatMessage,
    SpreadFollowUp,
    SpreadRecord,
    Subscription,
    SubscriptionPayment,
    User,
)
from app.payments import CreditError, credit
from app.telegram.bot_api import notify_purchase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_admin_user)) -> User:
    """
    Доступ ко всему роутеру. Проверка «кто администратор» живёт в
    app/api/deps.py::get_admin_user — она же решает, чем человек
    представился: пропуском админ-панели или initData мини-приложения.
    Обычный пользователь получает 403, как и на любой другой запрос не по
    праву.
    """
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
    # Сколько энергии продано за всё время и сколько из купленной ещё
    # лежит на счетах. Второе — не то же самое, что первое: это остаток,
    # то есть оплаченное, но не потреблённое. По сути обязательство
    # перед пользователями, и по нему же считается возврат.
    energy_sold_total: int
    energy_unspent: int


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

    energy_sold_total = db.execute(
        select(func.coalesce(func.sum(SubscriptionPayment.energy_amount), 0)).where(
            SubscriptionPayment.status == "succeeded",
            SubscriptionPayment.kind == "energy",
        )
    ).scalar_one()
    energy_unspent = db.execute(
        select(func.coalesce(func.sum(User.purchased_energy), 0))
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
        energy_sold_total=energy_sold_total,
        energy_unspent=energy_unspent,
    )


class AdminDayStats(BaseModel):
    """Один день в ряду. Дни идут подряд, включая пустые."""

    date: str
    new_users: int
    active_users: int
    spreads: int
    revenue_rub: int
    energy_sold: int


@router.get("/timeseries", response_model=list[AdminDayStats])
def get_timeseries(
    days: int = 30,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminDayStats]:
    """
    Активность по дням за последние `days` суток.

    Группировка идёт по календарной дате в UTC — той же, в которой лежат
    все created_at. Для Москвы это значит, что «день» заканчивается в 3
    часа ночи; для счётчика тенденций разница несущественная, а честный
    пересчёт в местное время потребовал бы хранить часовой пояс
    пользователя, которого у нас нет.

    Пустые дни возвращаются нулями, а не пропускаются: график с дырами
    врёт сильнее, чем график с нулями.
    """
    days = max(1, min(days, 180))
    end = dt.datetime.utcnow().date()
    start = end - dt.timedelta(days=days - 1)
    since = dt.datetime.combine(start, dt.time.min)

    def by_day(query) -> dict[str, int]:
        # func.date даёт строку в SQLite и date в Postgres — приводим к
        # строке на нашей стороне, чтобы ключи сходились в обоих случаях.
        return {str(day): int(value) for day, value in db.execute(query).all()}

    new_users = by_day(
        select(func.date(User.created_at), func.count())
        .where(User.created_at >= since)
        .group_by(func.date(User.created_at))
    )
    spreads = by_day(
        select(func.date(SpreadRecord.created_at), func.count())
        .where(SpreadRecord.created_at >= since)
        .group_by(func.date(SpreadRecord.created_at))
    )
    active = by_day(
        select(func.date(SpreadRecord.created_at), func.count(func.distinct(SpreadRecord.user_id)))
        .where(SpreadRecord.created_at >= since)
        .group_by(func.date(SpreadRecord.created_at))
    )
    revenue = by_day(
        select(
            func.date(SubscriptionPayment.created_at),
            func.coalesce(func.sum(SubscriptionPayment.amount_rub), 0),
        )
        .where(
            SubscriptionPayment.status == "succeeded",
            SubscriptionPayment.created_at >= since,
        )
        .group_by(func.date(SubscriptionPayment.created_at))
    )
    energy = by_day(
        select(
            func.date(SubscriptionPayment.created_at),
            func.coalesce(func.sum(SubscriptionPayment.energy_amount), 0),
        )
        .where(
            SubscriptionPayment.status == "succeeded",
            SubscriptionPayment.kind == "energy",
            SubscriptionPayment.created_at >= since,
        )
        .group_by(func.date(SubscriptionPayment.created_at))
    )

    result: list[AdminDayStats] = []
    for offset in range(days):
        day = str(start + dt.timedelta(days=offset))
        result.append(
            AdminDayStats(
                date=day,
                new_users=new_users.get(day, 0),
                active_users=active.get(day, 0),
                spreads=spreads.get(day, 0),
                revenue_rub=revenue.get(day, 0),
                energy_sold=energy.get(day, 0),
            )
        )
    return result


class AdminPaymentRow(BaseModel):
    """Строка ленты платежей — платёж вместе с тем, кто его совершил."""

    id: int
    created_at: dt.datetime
    user_id: int
    user_name: str
    username: str | None
    kind: str
    tier: str
    energy_amount: int
    amount_rub: int
    status: str
    provider: str
    provider_payment_id: str | None


class AdminPaymentsResponse(BaseModel):
    rows: list[AdminPaymentRow]
    # Итоги считаем по всему отфильтрованному набору, а не по показанной
    # странице: иначе сумма менялась бы при листании и не значила ничего.
    total_count: int
    succeeded_rub: int
    pending_count: int


@router.get("/payments", response_model=AdminPaymentsResponse)
def list_payments(
    days: int = 30,
    status: str = "all",
    kind: str = "all",
    limit: int = 100,
    offset: int = 0,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminPaymentsResponse:
    """
    Платежи за период, свежие сверху.

    Незавершённые (`pending`) показываются наравне с успешными и это
    важнее, чем кажется: именно они означают «деньги ушли, доступ не
    пришёл» — случай, под который в оферте написан пункт 4.5.1 о полном
    возврате. Прятать их за фильтром «только успешные» значило бы не
    видеть ровно тех, кому нужна помощь.
    """
    limit = max(1, min(limit, 500))

    conditions = []
    if days > 0:
        since = dt.datetime.utcnow() - dt.timedelta(days=days)
        conditions.append(SubscriptionPayment.created_at >= since)
    if status != "all":
        conditions.append(SubscriptionPayment.status == status)
    if kind != "all":
        conditions.append(SubscriptionPayment.kind == kind)

    total_count = db.execute(
        select(func.count()).select_from(SubscriptionPayment).where(*conditions)
    ).scalar_one()
    succeeded_rub = db.execute(
        select(func.coalesce(func.sum(SubscriptionPayment.amount_rub), 0)).where(
            *conditions, SubscriptionPayment.status == "succeeded"
        )
    ).scalar_one()
    pending_count = db.execute(
        select(func.count())
        .select_from(SubscriptionPayment)
        .where(*conditions, SubscriptionPayment.status == "pending")
    ).scalar_one()

    rows = db.execute(
        select(SubscriptionPayment, User)
        .join(User, User.telegram_id == SubscriptionPayment.user_id)
        .where(*conditions)
        .order_by(SubscriptionPayment.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return AdminPaymentsResponse(
        rows=[
            AdminPaymentRow(
                id=payment.id,
                created_at=payment.created_at,
                user_id=user.telegram_id,
                user_name=user.first_name,
                username=user.username,
                kind=payment.kind,
                tier=payment.tier,
                energy_amount=payment.energy_amount,
                amount_rub=payment.amount_rub,
                status=payment.status,
                provider=payment.provider,
                provider_payment_id=payment.provider_payment_id,
            )
            for payment, user in rows
        ],
        total_count=total_count,
        succeeded_rub=succeeded_rub,
        pending_count=pending_count,
    )


class AdminSpreadRow(BaseModel):
    spread_id: str
    title: str
    total: int
    # Сколько из них открыто целиком, то есть за энергию. Разница между
    # total и unlocked — это интерес без покупки: человек расклад начал,
    # но платить за толкование не стал.
    unlocked: int
    users: int


class AdminSpreadsResponse(BaseModel):
    rows: list[AdminSpreadRow]
    total: int
    unlocked_total: int
    follow_ups: int
    chat_questions: int


@router.get("/spreads", response_model=AdminSpreadsResponse)
def spreads_breakdown(
    days: int = 30,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminSpreadsResponse:
    """
    Какие расклады выбирают и сколько из них доводят до открытия.

    Название берём из самой записи (`spread_title`), а не из справочника
    раскладов: расклад могли переименовать, и старые записи должны
    называться так, как их видел человек в тот день.
    """
    conditions = []
    if days > 0:
        since = dt.datetime.utcnow() - dt.timedelta(days=days)
        conditions.append(SpreadRecord.created_at >= since)

    unlocked_sum = func.sum(case((SpreadRecord.unlocked.is_(True), 1), else_=0))

    rows = db.execute(
        select(
            SpreadRecord.spread_id,
            func.max(SpreadRecord.spread_title),
            func.count(),
            unlocked_sum,
            func.count(func.distinct(SpreadRecord.user_id)),
        )
        .where(*conditions)
        .group_by(SpreadRecord.spread_id)
        .order_by(func.count().desc())
    ).all()

    follow_ups = db.execute(
        select(func.count())
        .select_from(SpreadFollowUp)
        .where(
            *(
                [SpreadFollowUp.created_at >= since]
                if days > 0
                else []
            )
        )
    ).scalar_one()

    chat_questions = db.execute(
        select(func.count())
        .select_from(ChatMessage)
        .where(
            ChatMessage.role == "user",
            *([ChatMessage.created_at >= since] if days > 0 else []),
        )
    ).scalar_one()

    result = [
        AdminSpreadRow(
            spread_id=spread_id,
            title=title or spread_id,
            total=int(total),
            unlocked=int(unlocked or 0),
            users=int(users),
        )
        for spread_id, title, total, unlocked, users in rows
    ]

    return AdminSpreadsResponse(
        rows=result,
        total=sum(r.total for r in result),
        unlocked_total=sum(r.unlocked for r in result),
        follow_ups=follow_ups,
        chat_questions=chat_questions,
    )


class AdminPaymentActionResponse(BaseModel):
    status: str
    message: str


@router.post("/payments/{payment_id}/confirm", response_model=AdminPaymentActionResponse)
def confirm_payment(
    payment_id: int,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminPaymentActionResponse:
    """
    Зачесть платёж вручную.

    Нужен для случая, ради которого в оферте написан пункт 4.5.1: деньги
    у человека списались, а уведомление до нас не дошло — сбой сети,
    неверный пароль, упавший сервер. Обычный путь остаётся прежним, это
    аварийный.

    Зачесть можно только платёж в статусе «ожидает»: у уже оплаченного
    повторный зачёт начислил бы энергию дважды, а у отменённого нет
    денег, которые он бы отражал.

    **Перед нажатием сверься с кабинетом Робокассы.** Панель не знает,
    поступили ли деньги, — она знает лишь то, что мы выставили счёт.
    """
    payment = db.get(SubscriptionPayment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    if payment.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Платёж уже в статусе «{payment.status}», зачесть можно только ожидающий",
        )

    # Помечаем, чей это зачёт: в журнале Робокассы такого платежа может не
    # быть вовсе, и через полгода поле «идентификатор платежа у провайдера»
    # окажется единственным следом того, откуда взялась энергия.
    payment.provider_payment_id = f"manual:{admin.telegram_id}"
    try:
        what = credit(db, payment)
    except CreditError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logger.warning(
        "Ручной зачёт счёта %s администратором %s: пользователю %s начислено %s",
        payment.id, admin.telegram_id, payment.user_id, what,
    )
    # Человеку сообщение приходит одинаковое, зачли мы автоматически или
    # руками: для него это просто «покупка дошла».
    background.add_task(notify_purchase, payment.user_id, what)

    return AdminPaymentActionResponse(status="succeeded", message=f"Начислено: {what}")


@router.post("/payments/{payment_id}/cancel", response_model=AdminPaymentActionResponse)
def cancel_payment(
    payment_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminPaymentActionResponse:
    """
    Пометить незавершённый платёж отменённым.

    Ничего не возвращает и никого не трогает — просто убирает из списка
    ожидающих то, что оплачено не будет: брошенные корзины и следы
    проверок. Смысл в том, чтобы счётчик незавершённых показывал только
    настоящие проблемы.
    """
    payment = db.get(SubscriptionPayment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Платёж не найден")
    if payment.status != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Платёж уже в статусе «{payment.status}»",
        )

    payment.status = "canceled"
    db.commit()
    logger.warning(
        "Счёт %s отменён вручную администратором %s", payment.id, admin.telegram_id
    )
    return AdminPaymentActionResponse(status="canceled", message="Платёж помечен отменённым")


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
    # Наш собственный id платежа — и единственный идентификатор у
    # платежа, который не был доведён до конца: id на стороне платёжки
    # появляется только вместе с оплатой.
    id: int
    created_at: dt.datetime
    kind: str
    tier: str
    energy_amount: int
    amount_rub: int
    status: str
    provider: str
    provider_payment_id: str | None


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
                id=p.id,
                created_at=p.created_at,
                kind=p.kind,
                tier=p.tier,
                energy_amount=p.energy_amount,
                amount_rub=p.amount_rub,
                status=p.status,
                provider=p.provider,
                provider_payment_id=p.provider_payment_id,
            )
            for p in payments
        ],
        events=events[:60],
    )
