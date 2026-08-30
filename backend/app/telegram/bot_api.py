"""
Minimal Telegram Bot API client — just the one call the /start handler
needs. Notably not payments: the app has no payment provider connected,
and has never used Telegram's own Stars currency.
"""

import httpx

from app.config import settings


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
