"""
The daily "карта дня" reminder — a chat message sent once a day to
users who opted in via Profile → Уведомления (see
api/history.py::update_notifications). Scheduled in-process (see
app/main.py) rather than via an external cron, so no extra hosting
setup is needed beyond the app already running continuously on Railway.
"""

import datetime as dt
import logging

from sqlalchemy import or_, select

from app.config import settings
from app.db import SessionLocal
from app.models import User
from app.telegram.bot_api import TelegramApiError, send_app_launch_message

logger = logging.getLogger(__name__)


async def send_daily_reminders() -> None:
    if not settings.telegram_bot_token or not settings.mini_app_url:
        return  # nothing to send with / nowhere to send people — dev mode

    today = dt.datetime.utcnow().date().isoformat()
    db = SessionLocal()
    try:
        stmt = select(User).where(
            User.notifications_enabled.is_(True),
            or_(User.last_notified_date.is_(None), User.last_notified_date != today),
        )
        users = db.execute(stmt).scalars().all()

        for user in users:
            try:
                await send_app_launch_message(
                    chat_id=user.telegram_id,
                    text="✨ Ваша карта дня уже готова — загляните за подсказкой на сегодня.",
                    button_text="🔮 Открыть карту дня",
                    app_url=settings.mini_app_url,
                )
            except TelegramApiError:
                # Most likely the user blocked the bot — skip them today
                # rather than let one failure stop the rest of the batch.
                logger.warning("Failed to send daily reminder to user %s", user.telegram_id, exc_info=True)
            user.last_notified_date = today
            db.commit()
    finally:
        db.close()
