import datetime as dt

from pydantic import BaseModel

from app.spreads import SpreadId
from app.tarot.schemas import DrawnCard


class HistoryEntry(BaseModel):
    id: int
    spread_id: SpreadId
    spread_title: str
    completed_at: dt.datetime
    cards: list[DrawnCard]


class ProfileStats(BaseModel):
    total_spreads: int
    days_streak: int
