import datetime as dt

from pydantic import BaseModel, Field

from app.spreads import SpreadId
from app.tarot.cards import Arcana


class DrawSpreadRequest(BaseModel):
    spread_id: SpreadId
    # Optional context from the user — what they want the reading to
    # focus on. Stored on the record and fed into the AI interpretation
    # prompt (see app/api/ai.py) so a paid "подробное толкование" can
    # actually speak to what they asked, not just the cards in a vacuum.
    question: str | None = Field(default=None, max_length=500)


class DrawnCard(BaseModel):
    position: int = Field(..., description="0-indexed position within the spread")
    position_label: str
    card_id: str
    name: str
    arcana: Arcana
    is_reversed: bool
    # Short, free, static meaning for this card in its drawn orientation
    # (see app/tarot/meanings.py) — shown immediately so the user has
    # some context without paying for the full AI interpretation.
    meaning: str


class DrawSpreadResponse(BaseModel):
    id: int = Field(..., description="SpreadRecord id — used to request an interpretation or an extra card")
    spread_id: SpreadId
    # Empty while `unlocked` is false. The cards have already been drawn
    # and stored server-side at this point — they are simply not sent,
    # so a locked spread cannot be read out of the network response.
    cards: list[DrawnCard]
    # Whether this spread has been paid for. False means the client shows
    # `card_count` face-down backs and an unlock prompt.
    unlocked: bool = True
    # How many cards the spread has, which stays visible while locked so
    # the layout is right before anything is revealed.
    card_count: int = 0
    # Only set for spread_id="daily-card": when the 24-hour cooldown
    # since this card was drawn ends and a new one becomes available.
    # Null for every other spread type, which has no cooldown.
    next_available_at: dt.datetime | None = None
    # Сколько энергии начислено за серию дней подряд, если этот расклад
    # довёл её до порога (app/streaks.py). None — обычный случай: порог
    # не пройден или за него уже платили.
    streak_bonus: int | None = None
