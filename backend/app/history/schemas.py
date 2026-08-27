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
