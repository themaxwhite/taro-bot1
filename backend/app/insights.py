"""
Сводка по раскладам пользователя: активность по дням, статистика колоды
и достижения.

Всё считается на лету из уже сохранённых раскладов — ни одной новой
колонки. Карты лежат в `SpreadRecord.cards_json` вместе с `card_id`,
`arcana` и `is_reversed`, даты — в `created_at`, так что ответить на
«какая карта выпадает чаще» можно, ничего не начав записывать заранее.

Цена такого решения — разбор JSON всех раскладов пользователя на каждый
запрос. Для человека с сотнями раскладов это десятки килобайт и разбор в
пределах миллисекунд, а экран профиля открывают не в цикле. Если счёт
пойдёт на тысячи, это первое место, куда стоит поставить кэш.
"""

import datetime as dt
import json
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import SpreadRecord, User
from app.spreads import CHOOSABLE_SPREADS, SPREADS
from app.streaks import longest_streak

# Окно карты активности. 98 дней — это 14 недель, но столбцов на экране
# выходит 15: сетка выравнивается по понедельникам, и первая колонка
# почти всегда прихватывает хвост предыдущей недели. 15 столбцов по 11px
# с промежутками занимают ~207px и помещаются даже в узкий телефон, а
# если не поместятся — карточка прокручивается внутри себя.
ACTIVITY_WEEKS = 14
ACTIVITY_DAYS = ACTIVITY_WEEKS * 7


@dataclass(frozen=True)
class Achievement:
    id: str
    title: str
    description: str
    glyph: str
    unlocked: bool


def activity_by_day(db: Session, user_id: int) -> tuple[dict[str, int], dt.date, dt.date]:
    """
    Сколько раскладов сделано в каждый день окна.

    Возвращает только непустые дни: пустых в окне большинство, и гонять
    их через сеть незачем — сетку по датам фронтенд достроит сам.
    """
    today = dt.datetime.utcnow().date()
    start = today - dt.timedelta(days=ACTIVITY_DAYS - 1)

    rows = db.execute(
        select(SpreadRecord.created_at).where(
            SpreadRecord.user_id == user_id,
            SpreadRecord.created_at >= dt.datetime.combine(start, dt.time.min),
        )
    ).scalars().all()

    counts: Counter[str] = Counter(ts.date().isoformat() for ts in rows)
    return dict(counts), start, today


def deck_stats(db: Session, user_id: int) -> dict:
    """Что за карты человеку выпадают: частота, перевёрнутые, старшие арканы."""
    rows = db.execute(
        select(SpreadRecord.cards_json, SpreadRecord.spread_id).where(SpreadRecord.user_id == user_id)
    ).all()

    card_counts: Counter[tuple[str, str]] = Counter()
    spread_counts: Counter[str] = Counter()
    total = reversed_count = major_count = 0

    for cards_json, spread_id in rows:
        spread_counts[spread_id] += 1
        try:
            cards = json.loads(cards_json)
        except (TypeError, ValueError):
            # Битая запись не должна ронять весь экран профиля.
            continue
        for card in cards:
            total += 1
            card_counts[(card["card_id"], card["name"])] += 1
            if card.get("is_reversed"):
                reversed_count += 1
            if card.get("arcana") == "major":
                major_count += 1

    favorite_id, favorite_count = (spread_counts.most_common(1) or [(None, 0)])[0]
    favorite_config = SPREADS.get(favorite_id) if favorite_id else None

    return {
        "top_cards": [
            {"card_id": card_id, "name": name, "count": count}
            for (card_id, name), count in card_counts.most_common(3)
        ],
        "total_cards": total,
        # Проценты, а не доли: на экране всё равно стоит знак процента, а
        # округление в одном месте честнее, чем в каждом из потребителей.
        "reversed_share": round(reversed_count / total * 100) if total else 0,
        "major_share": round(major_count / total * 100) if total else 0,
        "favorite_spread": favorite_config.title if favorite_config else None,
        "favorite_spread_count": favorite_count,
    }


def achievements(db: Session, user: User) -> list[Achievement]:
    """
    Вехи, посчитанные на лету.

    Ничего не хранится: каждое достижение — это вопрос к уже имеющимся
    данным. Поэтому их нельзя «потерять» рассинхроном, и добавление
    нового не требует пересчёта задним числом для тех, кто веху уже
    прошёл.
    """
    spreads_total = db.execute(
        select(func.count()).select_from(SpreadRecord).where(SpreadRecord.user_id == user.telegram_id)
    ).scalar_one()

    # Считаем только выбираемые расклады: «Карта дня» бесплатна и
    # вытягивается почти случайно, так что засчитывать её в «все
    # расклады» — значит удешевить достижение. Тот же набор использует
    # подсказка «чего вы ещё не пробовали».
    choosable_ids = {s.value for s in CHOOSABLE_SPREADS}
    tried_spreads = set(
        db.execute(
            select(SpreadRecord.spread_id).where(SpreadRecord.user_id == user.telegram_id).distinct()
        ).scalars().all()
    )
    distinct_spreads = len(tried_spreads & choosable_ids)

    invited = db.execute(
        select(func.count()).select_from(User).where(User.referred_by == user.telegram_id)
    ).scalar_one()

    best_streak = longest_streak(db, user.telegram_id)

    return [
        Achievement("first-spread", "Первый расклад", "Карты разложены впервые", "🌱", spreads_total >= 1),
        Achievement("ten-spreads", "Десять раскладов", "Уже не случайный интерес", "🔟", spreads_total >= 10),
        Achievement("fifty-spreads", "Пятьдесят раскладов", "Колода стала привычкой", "🏛", spreads_total >= 50),
        Achievement("week-streak", "Неделя подряд", "Семь дней без пропуска", "🔥", best_streak >= 7),
        Achievement("month-streak", "Месяц подряд", "Тридцать дней без пропуска", "🌟", best_streak >= 30),
        Achievement(
            "every-spread",
            "Все расклады",
            f"Опробованы все {len(CHOOSABLE_SPREADS)} видов",
            "🗺",
            distinct_spreads >= len(CHOOSABLE_SPREADS),
        ),
        Achievement("inviter", "Позвал друга", "Кто-то пришёл по вашей ссылке", "🎁", invited >= 1),
    ]
