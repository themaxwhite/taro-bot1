from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.telegram.bot_api import send_app_launch_message

router = APIRouter(prefix="/api", tags=["telegram"])


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict:
    """
    Telegram calls this directly (not from the Mini App) for bot chat
    updates — configure it once via `setWebhook` (see DEPLOYMENT.md).
    Authenticated by the secret token Telegram echoes back in a header,
    not by user initData. This is the only webhook the app has: there
    is no payment provider connected, so nothing confirms purchases
    (see api/subscriptions.py).
    """
    if settings.telegram_webhook_secret:
        header = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if header != settings.telegram_webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    update = await request.json()
    message = update.get("message") or {}

    if message.get("text", "").startswith("/start") and settings.mini_app_url:
        await send_app_launch_message(
            chat_id=message["chat"]["id"],
            text="Tarot Aurum — расклады таро с AI-толкованием и картой дня.",
            button_text="🔮 Начать расклад",
            app_url=settings.mini_app_url,
        )

    return {"ok": True}
