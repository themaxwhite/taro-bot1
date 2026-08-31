"""
Ограничение частоты обращений к отдельным эндпойнтам.

Считаем в памяти процесса, без Redis и без внешних зависимостей. Это
осознанное упрощение: приложение работает одним экземпляром, а защищать
надо ровно два места — подбор промокода и регистрацию реферала. Если
экземпляров станет несколько, счётчик у каждого будет свой, и предел
фактически умножится на их число; на этом этапе цена такой неточности
ниже, чем цена лишней инфраструктуры.

Ключ — идентификатор пользователя Telegram, а не IP: каждый запрос уже
подписан Telegram, подделать чужой id нельзя, а IP у мобильных клиентов
общий на многих людей сразу.
"""

import time
from collections import deque

from fastapi import HTTPException

# Ключ -> отметки времени последних попыток, старые вычищаются на месте.
_hits: dict[str, deque[float]] = {}

# Порог, после которого словарь чистится от опустевших ключей. Без этого
# он растёт на каждого пользователя, который хоть раз нажал кнопку, и не
# уменьшается никогда.
_CLEANUP_THRESHOLD = 10_000


def check_rate_limit(scope: str, user_id: int, *, limit: int, window_seconds: int) -> None:
    """
    Пропускает не более `limit` обращений к `scope` от одного пользователя
    за последние `window_seconds` секунд. Сверх того — 429.

    Вызывается до того, как эндпойнт сделает что-либо полезное.
    """
    now = time.monotonic()
    key = f"{scope}:{user_id}"

    hits = _hits.setdefault(key, deque())
    cutoff = now - window_seconds
    while hits and hits[0] < cutoff:
        hits.popleft()

    if len(hits) >= limit:
        # Сколько ждать — считаем от самой старой попытки в окне.
        retry_after = max(1, int(hits[0] + window_seconds - now) + 1)
        raise HTTPException(
            status_code=429,
            detail="Слишком много попыток. Попробуйте позже.",
            headers={"Retry-After": str(retry_after)},
        )

    hits.append(now)

    if len(_hits) > _CLEANUP_THRESHOLD:
        _prune(now)


def _prune(now: float) -> None:
    """Убирает ключи, по которым не осталось ни одной свежей отметки."""
    for key in [k for k, v in _hits.items() if not v or v[-1] < now - 3600]:
        _hits.pop(key, None)
