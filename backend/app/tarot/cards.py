from dataclasses import dataclass
from enum import Enum


class Arcana(str, Enum):
    MAJOR = "major"
    MINOR = "minor"


@dataclass(frozen=True)
class Card:
    id: str
    name: str
    arcana: Arcana


MAJOR_ARCANA: list[Card] = [
    Card("major-00", "Шут", Arcana.MAJOR),
    Card("major-01", "Маг", Arcana.MAJOR),
    Card("major-02", "Верховная Жрица", Arcana.MAJOR),
    Card("major-03", "Императрица", Arcana.MAJOR),
    Card("major-04", "Император", Arcana.MAJOR),
    Card("major-05", "Иерофант", Arcana.MAJOR),
    Card("major-06", "Влюблённые", Arcana.MAJOR),
    Card("major-07", "Колесница", Arcana.MAJOR),
    Card("major-08", "Сила", Arcana.MAJOR),
    Card("major-09", "Отшельник", Arcana.MAJOR),
    Card("major-10", "Колесо Фортуны", Arcana.MAJOR),
    Card("major-11", "Справедливость", Arcana.MAJOR),
    Card("major-12", "Повешенный", Arcana.MAJOR),
    Card("major-13", "Смерть", Arcana.MAJOR),
    Card("major-14", "Умеренность", Arcana.MAJOR),
    Card("major-15", "Дьявол", Arcana.MAJOR),
    Card("major-16", "Башня", Arcana.MAJOR),
    Card("major-17", "Звезда", Arcana.MAJOR),
    Card("major-18", "Луна", Arcana.MAJOR),
    Card("major-19", "Солнце", Arcana.MAJOR),
    Card("major-20", "Суд", Arcana.MAJOR),
    Card("major-21", "Мир", Arcana.MAJOR),
]

_MINOR_SUITS = [
    ("wands", "Жезлов"),
    ("cups", "Кубков"),
    ("swords", "Мечей"),
    ("pentacles", "Пентаклей"),
]

_MINOR_RANKS = [
    ("ace", "Туз"),
    ("02", "Двойка"),
    ("03", "Тройка"),
    ("04", "Четвёрка"),
    ("05", "Пятёрка"),
    ("06", "Шестёрка"),
    ("07", "Семёрка"),
    ("08", "Восьмёрка"),
    ("09", "Девятка"),
    ("10", "Десятка"),
    ("page", "Паж"),
    ("knight", "Рыцарь"),
    ("queen", "Королева"),
    ("king", "Король"),
]


def _build_minor_arcana() -> list[Card]:
    cards: list[Card] = []
    for suit_id, suit_name in _MINOR_SUITS:
        for rank_id, rank_name in _MINOR_RANKS:
            cards.append(
                Card(
                    id=f"minor-{suit_id}-{rank_id}",
                    name=f"{rank_name} {suit_name}",
                    arcana=Arcana.MINOR,
                )
            )
    return cards


MINOR_ARCANA: list[Card] = _build_minor_arcana()

FULL_DECK: list[Card] = MAJOR_ARCANA + MINOR_ARCANA

assert len(FULL_DECK) == 78, f"Expected 78 cards, got {len(FULL_DECK)}"


# Идентификаторы старших арканов — из самой колоды, а не вторым списком
# рядом: карта-покровитель (api/history.py::update_patron_card) должна
# проверяться по тому же набору, из которого карты выпадают в раскладах.
MAJOR_ARCANA_IDS: frozenset[str] = frozenset(c.id for c in FULL_DECK if c.id.startswith("major-"))
