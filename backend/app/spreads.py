from dataclasses import dataclass
from enum import Enum


class SpreadId(str, Enum):
    DAILY_CARD = "daily-card"
    LOVE = "love"
    FUTURE = "future"
    CELTIC_CROSS = "celtic-cross"
    YES_NO = "yes-no"
    HORSESHOE = "horseshoe"
    COMPATIBILITY = "compatibility"
    WORK = "work"
    CROSSROADS = "crossroads"
    MIRROR = "mirror"
    MONTH = "month"


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
    SpreadId.COMPATIBILITY: SpreadConfig(
        id=SpreadId.COMPATIBILITY,
        title="Совместимость",
        card_count=5,
        position_labels=(
            "Ты",
            "Партнёр",
            "Что вас связывает",
            "Трудности",
            "Потенциал отношений",
        ),
    ),
    SpreadId.WORK: SpreadConfig(
        id=SpreadId.WORK,
        title="Работа и деньги",
        card_count=4,
        position_labels=(
            "Где вы сейчас",
            "Что мешает",
            "Незамеченная возможность",
            "Совет",
        ),
    ),
    SpreadId.CROSSROADS: SpreadConfig(
        id=SpreadId.CROSSROADS,
        title="Два пути",
        card_count=5,
        # Позиции не повторяются дословно («К чему приведёт» дважды) —
        # они уходят в промпт толкования построчно, и одинаковые подписи
        # там неотличимы друг от друга.
        position_labels=(
            "Суть выбора",
            "Первый путь — что он даст",
            "Первый путь — чего будет стоить",
            "Второй путь — что он даст",
            "Второй путь — чего будет стоить",
        ),
    ),
    SpreadId.MIRROR: SpreadConfig(
        id=SpreadId.MIRROR,
        title="Зеркало",
        card_count=4,
        position_labels=(
            "Каким вы себя видите",
            "Каким вас видят другие",
            "Что вы прячете",
            "Что стоит принять",
        ),
    ),
    SpreadId.MONTH: SpreadConfig(
        id=SpreadId.MONTH,
        title="Месяц впереди",
        card_count=4,
        position_labels=(
            "Начало месяца",
            "Середина",
            "Конец месяца",
            "Главная тема",
        ),
    ),
}


# Расклады, которые человек выбирает сам, — вся витрина, кроме «Карты
# дня». Она бесплатна, живёт отдельным баннером и вытягивается почти
# случайно, поэтому и в подсказке «чего вы ещё не пробовали», и в
# достижении «Все расклады» она не участвует. Набор один на оба места:
# два разных ответа на вопрос «все — это сколько?» пользователь читает
# как ошибку.
CHOOSABLE_SPREADS: tuple[SpreadId, ...] = tuple(s for s in SPREADS if s != SpreadId.DAILY_CARD)
