from dataclasses import dataclass
from enum import Enum


class SpreadId(str, Enum):
    DAILY_CARD = "daily-card"
    LOVE = "love"
    FUTURE = "future"
    CELTIC_CROSS = "celtic-cross"
    YES_NO = "yes-no"
    HORSESHOE = "horseshoe"


@dataclass(frozen=True)
class SpreadConfig:
    id: SpreadId
    title: str
    card_count: int
    # Position labels, in draw order — must match card_count.
    position_labels: tuple[str, ...]


# IMPORTANT: keep spread_id values, titles and card_count in sync with
# frontend/src/types/tarot.ts (SPREAD_TYPES). Any change here requires
# a matching change on the frontend, and vice versa.
SPREADS: dict[SpreadId, SpreadConfig] = {
    SpreadId.DAILY_CARD: SpreadConfig(
        id=SpreadId.DAILY_CARD,
        title="Карта дня",
        card_count=1,
        position_labels=("Карта дня",),
    ),
    SpreadId.LOVE: SpreadConfig(
        id=SpreadId.LOVE,
        title="Любовь",
        card_count=3,
        position_labels=("Прошлое", "Настоящее", "Возможное развитие"),
    ),
    SpreadId.FUTURE: SpreadConfig(
        id=SpreadId.FUTURE,
        title="Будущее",
        card_count=3,
        position_labels=("Текущая ситуация", "Скрытый фактор", "Развитие"),
    ),
    SpreadId.CELTIC_CROSS: SpreadConfig(
        id=SpreadId.CELTIC_CROSS,
        title="Кельтский крест",
        card_count=10,
        position_labels=(
            "Текущая ситуация",
            "Вызов",
            "Основа",
            "Прошлое",
            "Возможный исход",
            "Ближайшее будущее",
            "Ваше отношение",
            "Внешнее влияние",
            "Надежды и страхи",
            "Итог",
        ),
    ),
    SpreadId.YES_NO: SpreadConfig(
        id=SpreadId.YES_NO,
        title="Да или нет",
        card_count=1,
        position_labels=("Ответ",),
    ),
    SpreadId.HORSESHOE: SpreadConfig(
        id=SpreadId.HORSESHOE,
        title="Подкова",
        card_count=7,
        position_labels=(
            "Прошлое",
            "Настоящее",
            "Скрытые влияния",
            "Препятствия",
            "Окружение",
            "Совет",
            "Итог",
        ),
    ),
}
