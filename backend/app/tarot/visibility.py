"""
Одно место, решающее, можно ли показать карты расклада.

Расклад стоит одной разблокировки, и до неё карты не должны покидать
сервер: прятать их на фронтенде бессмысленно — достаточно открыть вкладку
«сеть» в браузере. Поэтому любой эндпоинт, отдающий расклад наружу,
обязан пройти через `visible_cards`, а не читать `cards_json` напрямую.

Исключение ровно одно — «карта дня»: она бесплатна и создаётся сразу
разблокированной (см. api/spreads.py).
"""

import json

from app.models import SpreadRecord
from app.tarot.schemas import DrawnCard


def stored_cards(record: SpreadRecord) -> list[DrawnCard]:
    """Все карты расклада, как их выбрал движок. Только для внутреннего использования."""
    return [DrawnCard.model_validate(c) for c in json.loads(record.cards_json)]


def visible_cards(record: SpreadRecord) -> list[DrawnCard]:
    """Карты, которые разрешено отдать клиенту: пусто, пока не оплачено."""
    return stored_cards(record) if record.unlocked else []


def card_count(record: SpreadRecord) -> int:
    """Сколько карт в раскладе — видно и до оплаты, чтобы отрисовать рубашки."""
    return len(json.loads(record.cards_json))
