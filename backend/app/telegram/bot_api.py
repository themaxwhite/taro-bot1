"""
Минимальный клиент Bot API: приветствие на /start и сообщение о зачислении
покупки. Оплата идёт через Робокассу, собственная валюта Telegram здесь не
используется.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramApiError(Exception):
    pass


def _base_url() -> str:
    if not settings.telegram_bot_token:
        raise TelegramApiError("TELEGRAM_BOT_TOKEN is not configured")
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}"


async def _call(method: str, payload: dict) -> "dict | str":
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(f"{_base_url()}/{method}", json=payload)
    data = response.json()
    if not data.get("ok"):
        raise TelegramApiError(f"{method} failed: {data.get('description')}")
    return data["result"]


async def send_app_launch_message(chat_id: int, text: str, button_text: str, app_url: str) -> None:
    """
    Sends a plain chat message with an inline `web_app` button. This is
    deliberately separate from BotFather's chat *menu* button (the one
    next to the message input) — that one is configured once via
    `/setmenubutton` and Telegram can be slow to pick up changes to it,
    so this gives a second, always-fresh way to launch the Mini App and
    doubles as a way to tell the two failure modes apart: if this button
    opens the app but the menu button still doesn't, the problem is the
    BotFather menu-button config, not the app itself.
    """
    await _call(
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "reply_markup": {
                "inline_keyboard": [[{"text": button_text, "web_app": {"url": app_url}}]]
            },
        },
    )


def notify_purchase(user_id: int, what: str) -> None:
    """
    Сообщает человеку в бот, что покупка зачислена.

    Вызывается после начисления, а не вместо него, и намеренно ничего не
    возвращает: если сообщение не ушло, покупка всё равно состоялась, и
    ронять из-за этого запрос нельзя.

    Самый частый отказ — «bot was blocked» или «chat not found»: бот вправе
    писать только тому, кто хоть раз нажал у него Start. Человек, открывший
    мини-приложение по прямой ссылке, мог этого не делать никогда. Поэтому
    отказ пишем в лог спокойно, как ожидаемый случай, а не как ошибку.

    Клиент синхронный: вызывается из фоновой задачи FastAPI, где событийный
    цикл ждать нечего, зато один и тот же код работает и в асинхронном
    обработчике уведомления, и в синхронной ручке ручного зачёта.
    """
    if not settings.telegram_bot_token:
        return

    text = f"""✦ Оплата прошла. Начислено: {what}.

Энергия уже на счету — можно открывать расклад."""

    try:
        response = httpx.post(
            f"{_base_url()}/sendMessage",
            json={"chat_id": user_id, "text": text},
            timeout=10.0,
        )
        data = response.json()
        if not data.get("ok"):
            logger.info(
                "Не удалось написать пользователю %s о покупке: %s",
                user_id, data.get("description"),
            )
    except Exception:
        logger.exception("Сбой при отправке сообщения о покупке пользователю %s", user_id)
