import datetime as dt

from pydantic import BaseModel

from app.spreads import SpreadId
from app.tarot.schemas import DrawnCard


class FollowUpEntry(BaseModel):
    question_key: str
    question_label: str
    answer: str


class HistoryEntry(BaseModel):
    id: int
    spread_id: SpreadId
    spread_title: str
    completed_at: dt.datetime
    # Empty for a spread that was never unlocked — same rule as
    # DrawSpreadResponse, so history cannot be used as a back door to
    # read cards that were not paid for.
    cards: list[DrawnCard]
    unlocked: bool = True
    card_count: int = 0
    question: str | None
    interpretation: str | None
    follow_ups: list[FollowUpEntry]


class ProfileStats(BaseModel):
    total_spreads: int
    days_streak: int
    # Ближайший непройденный порог серии и его награда — чтобы профиль
    # показывал, ради чего эта цифра растёт. Оба None, когда все пороги
    # текущей серии уже выданы.
    next_reward_day: int | None = None
    next_reward_energy: int | None = None


class ActivityDay(BaseModel):
    date: str  # "YYYY-MM-DD"
    count: int


class TopCard(BaseModel):
    card_id: str
    name: str
    count: int


class AchievementEntry(BaseModel):
    id: str
    title: str
    description: str
    glyph: str
    unlocked: bool


class ProfileInsights(BaseModel):
    """Сводка для профиля — см. app/insights.py."""

    # Только дни, в которые расклады были: пустых в окне большинство, и
    # сетку по датам фронтенд достраивает сам.
    activity: list[ActivityDay]
    activity_from: str
    activity_to: str
    top_cards: list[TopCard]
    total_cards: int
    reversed_share: int
    major_share: int
    favorite_spread: str | None
    favorite_spread_count: int
    achievements: list[AchievementEntry]
