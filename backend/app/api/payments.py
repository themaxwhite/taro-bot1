import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.telegram.bot_api import send_app_launch_message

logger = logging.getLogger(__name__)

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
        try:
            await send_app_launch_message(
                chat_id=message["chat"]["id"],
                text="Taro Aurum — расклады таро с AI-толкованием и картой дня.",
                button_text="🔮 Начать расклад",
                app_url=settings.mini_app_url,
            )
        except Exception:
            # Ответить 500 здесь — худшее из возможного: Telegram считает
            # такой вебхук неисправным, помечает его ошибкой и повторяет
            # доставку. Одна неверная переменная так останавливает
            # обработку всех апдейтов, а не только этого сообщения. Ровно
            # это и случилось, когда в MINI_APP_URL попали два адреса через
            # запятую: кнопка получалась с невалидной ссылкой, Telegram
            # отвечал отказом, а наружу уходил 500.
            #
            # Ловим любое исключение, а не только TelegramApiError: сюда же
            # относятся таймаут и обрыв соединения с api.telegram.org, и
            # последствия у них те же. Пользователь при этом всё равно
            # откроет приложение кнопкой меню рядом с полем ввода, так что
            # неудачная отправка не причина ломать вебхук.
            logger.exception(
                "Не удалось ответить на /start для чата %s",
                message.get("chat", {}).get("id"),
            )

    return {"ok": True}
