"""
Minimal Telegram Bot API client — just the three calls the payments flow
needs. Uses Telegram Stars (currency "XTR"), Telegram's own in-app
currency, so no external payment-provider account is required (no
provider_token, unlike classic card payments).
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


async def create_invoice_link(*, title: str, description: str, payload: str, stars: int) -> str:
    result = await _call(
        "createInvoiceLink",
        {
            "title": title,
            "description": description,
            "payload": payload,
            "provider_token": "",  # empty for Telegram Stars
            "currency": "XTR",
            "prices": [{"label": title, "amount": stars}],
        },
    )
    assert isinstance(result, str)  # createInvoiceLink returns the link as a plain string
    return result


async def answer_pre_checkout_query(pre_checkout_query_id: str, ok: bool, error_message: str | None = None) -> None:
    body = {"pre_checkout_query_id": pre_checkout_query_id, "ok": ok}
    if error_message:
        body["error_message"] = error_message
    await _call("answerPreCheckoutQuery", body)


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
