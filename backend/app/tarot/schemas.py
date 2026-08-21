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


class DrawSpreadResponse(BaseModel):
    id: int = Field(..., description="SpreadRecord id — used to request an interpretation or an extra card")
    spread_id: SpreadId
    cards: list[DrawnCard]
