"""
Пропуск в админ-панель.

После входа через Telegram бэкенд выдаёт панели собственный короткий
пропуск, а не пересылает ей id_token. Причин две. Во-первых, id_token
живёт по правилам Telegram, а не по нашим, и отозвать его нельзя.
Во-вторых, панель кладёт пропуск в localStorage, и класть туда чужой
токен с лишними полями (телефон, имя, аватар) незачем — нам нужен только
факт «это администратор такой-то».

Пропуск подписан и ничего не хранит на сервере: сессий нет, перезапуск
бэкенда никого не выкидывает. Формат:

    <telegram_id>.<истекает>.<подпись>

Ключ подписи выводится из токена бота, а не заводится отдельной
переменной: это уже самый секретный секрет в системе, и добавлять рядом
ещё один, который придётся не потерять при переезде, — лишняя сущность.
Побочный эффект осознанный: смена токена бота разлогинивает панель.
"""

import hashlib
import hmac
import time

# Сутки: столько же, сколько жил пропуск старого виджета. Дольше делать
# незачем — вход занимает два нажатия.
SESSION_TTL_SECONDS = 86400


class AdminSessionError(Exception):
    """Пропуск отсутствует, испорчен, подделан или просрочен."""


def _key(bot_token: str) -> bytes:
    return hashlib.sha256((bot_token + ":admin-session").encode()).digest()


def _sign(payload: str, bot_token: str) -> str:
    return hmac.new(_key(bot_token), payload.encode(), hashlib.sha256).hexdigest()


def issue(telegram_id: int, bot_token: str, ttl_seconds: int = SESSION_TTL_SECONDS) -> str:
    payload = f"{telegram_id}.{int(time.time()) + ttl_seconds}"
    return f"{payload}.{_sign(payload, bot_token)}"


def verify(token: str, bot_token: str) -> int:
    """Возвращает telegram_id владельца пропуска или бросает AdminSessionError."""
    parts = token.split(".")
    if len(parts) != 3:
        raise AdminSessionError("Malformed admin session")

    raw_id, raw_expires, signature = parts
    payload = f"{raw_id}.{raw_expires}"

    # Сравнение постоянного времени: обычное == подсказало бы подбирающему,
    # сколько символов подписи он уже угадал.
    if not hmac.compare_digest(_sign(payload, bot_token), signature):
        raise AdminSessionError("Invalid admin session signature")

    if not raw_expires.isdigit() or int(raw_expires) < time.time():
        raise AdminSessionError("Admin session has expired")

    if not raw_id.lstrip("-").isdigit():
        raise AdminSessionError("Malformed admin session")

    return int(raw_id)
