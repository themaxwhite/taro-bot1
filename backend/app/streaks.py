"""
Серия дней подряд и награда за неё.

Стрик считался и раньше, но только показывался в профиле цифрой и ничего
не давал. Здесь он становится поводом вернуться завтра: на 7-й и 30-й
день подряд начисляется энергия.

Награда падает в `purchased_energy`, а не в суточную `energy`. Суточная
перезаписывается на следующее утро (models.py::User.energy), и бонус за
месяц дисциплины сгорел бы, не дожив до вечера — а награда, которая
исчезает сама, работает против того, ради чего её выдали.
"""

import datetime as dt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SpreadRecord, User

# День серии -> сколько энергии за него дают. Порогов намеренно мало и
# они растущие: награда на каждый третий день перестаёт читаться как
# награда и становится просто ещё одной строчкой начислений.
STREAK_REWARDS: dict[int, int] = {7: 3, 30: 10}


def days_streak(db: Session, user_id: int) -> int:
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


def next_reward(streak: int, rewarded_day: int) -> tuple[int, int] | None:
    """
    Ближайший непройденный порог как (день серии, сколько энергии), или
    None, если все пороги этой серии уже выданы.

    `rewarded_day` — длина серии, за которую в последний раз платили;
    пороги ниже него в этой серии уже отработали.
    """
    passed = rewarded_day if rewarded_day <= streak else 0
    upcoming = sorted(day for day in STREAK_REWARDS if day > passed)
    if not upcoming:
        return None
    day = upcoming[0]
    return day, STREAK_REWARDS[day]


def award_streak_bonus(db: Session, user: User) -> int | None:
    """
    Начисляет награду, если сегодняшний расклад довёл серию до порога.
    Возвращает выданное количество энергии или None.

    Вызывать после того, как расклад уже сохранён: серия считается по
    записям в базе, и без коммита сегодняшний день в неё не попадёт.

    Пороги внутри одной серии выдаются по одному разу, но сама серия
    повторяема: если она прервалась и человек набрал семь дней заново,
    он получит бонус снова — иначе вернувшийся пользователь оказался бы
    в худшем положении, чем новый.
    """
    streak = days_streak(db, user.telegram_id)

    # Серия оборвалась и началась заново — прошлые пороги больше не в
    # счёт. Сравнение именно с длиной серии: хранить дату сброса не
    # нужно, короткая серия сама доказывает, что старая кончилась.
    if streak < user.streak_reward_day:
        user.streak_reward_day = 0

    earned = [day for day in STREAK_REWARDS if user.streak_reward_day < day <= streak]
    if not earned:
        return None

    # Сразу несколько порогов за один расклад невозможно при обычном
    # ходе дел (серия растёт по одному дню), но если это всё же
    # случилось, честнее выдать всё, чем молча проглотить.
    day = max(earned)
    amount = sum(STREAK_REWARDS[d] for d in earned)
    user.purchased_energy += amount
    user.streak_reward_day = day
    db.commit()
    return amount
