import random

from app.spreads import SPREADS, SpreadId
from app.tarot.cards import FULL_DECK
from app.tarot.meanings import meaning_for
from app.tarot.schemas import DrawnCard


class TarotEngine:
    """
    The single source of truth for card selection, randomness, and
    orientation. Per the project's architectural constraint, the
    frontend never decides which cards appear or how they're oriented —
    it only displays what this engine returns.
    """

    def __init__(self, rng: random.Random | None = None) -> None:
        # Injectable RNG makes this deterministic/testable when needed
        # (e.g. `TarotEngine(random.Random(42))` in tests).
        self._rng = rng or random.Random()

    def draw(self, spread_id: SpreadId) -> list[DrawnCard]:
        config = SPREADS[spread_id]
        drawn_cards = self._rng.sample(FULL_DECK, k=config.card_count)
        cards = []
        for index, card in enumerate(drawn_cards):
            is_reversed = self._rng.random() < 0.5
            cards.append(
                DrawnCard(
                    position=index,
                    position_label=config.position_labels[index],
                    card_id=card.id,
                    name=card.name,
                    arcana=card.arcana,
                    is_reversed=is_reversed,
                    meaning=meaning_for(card.id, is_reversed),
                )
            )
        return cards

    def draw_one_more(self, position: int, position_label: str, exclude_card_ids: set[str]) -> DrawnCard:
        """Draws a single extra card that isn't already present in the spread (paid "доп. карта" feature)."""
        pool = [card for card in FULL_DECK if card.id not in exclude_card_ids]
        card = self._rng.choice(pool)
        is_reversed = self._rng.random() < 0.5
        return DrawnCard(
            position=position,
            position_label=position_label,
            card_id=card.id,
            name=card.name,
            arcana=card.arcana,
            is_reversed=is_reversed,
            meaning=meaning_for(card.id, is_reversed),
        )


# Module-level singleton — stateless aside from the RNG, safe to share
# across requests.
tarot_engine = TarotEngine()
