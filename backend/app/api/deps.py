import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.telegram.auth import TelegramAuthError, TelegramUser, validate_init_data

logger = logging.getLogger(__name__)

_warned_dev_mode = False

# Fixed placeholder id used to attribute requests to *some* user row when
# running without a real bot token, so history/stats stay testable
# end-to-end locally. Real Telegram user ids are always positive, so 0
# can't collide with one.
DEV_MODE_USER_ID = 0


def get_telegram_user(
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
) -> TelegramUser | None:
    """
    FastAPI dependency that validates the `X-Telegram-Init-Data` header
    and returns the authenticated Telegram user.

    Dev-mode fallback: if TELEGRAM_BOT_TOKEN is not configured, validation
    is skipped entirely (returns None) so the API remains usable via
    Swagger/curl during local development without a real bot. This must
    never be the case in production — see README.
    """
    if not settings.telegram_bot_token:
        global _warned_dev_mode
        if not _warned_dev_mode:
            logger.warning(
                "TELEGRAM_BOT_TOKEN is not set — skipping initData validation. "
                "This is only safe for local development."
            )
            _warned_dev_mode = True
        return None

    if not x_telegram_init_data:
        raise HTTPException(status_code=401, detail="Missing X-Telegram-Init-Data header")

    try:
        return validate_init_data(x_telegram_init_data, settings.telegram_bot_token)
    except TelegramAuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


def get_current_user(
    telegram_user: TelegramUser | None = Depends(get_telegram_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Resolves the authenticated request to a persisted `User` row,
    creating or updating it as needed (Telegram doesn't notify us of
    profile changes, so we just refresh name/username on every request).
    In dev mode (telegram_user is None) everything is attributed to a
    fixed placeholder user so history/stats work locally too.
    """
    if telegram_user is not None:
        user_id, first_name, username = telegram_user.id, telegram_user.first_name, telegram_user.username
    else:
        user_id, first_name, username = DEV_MODE_USER_ID, "Dev User", None

    user = db.get(User, user_id)
    if user is None:
        user = User(telegram_id=user_id, first_name=first_name, username=username)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # A brand-new user's first Mini App open fires several
            # requests in parallel (daily message, profile stats,
            # interests, ...) — two of them can both find no row here and
            # race to insert it. The loser falls back to updating the
            # winner's row instead of crashing.
            db.rollback()
            user = db.get(User, user_id)
            user.first_name = first_name
            user.username = username
            db.commit()
    else:
        user.first_name = first_name
        user.username = username
        db.commit()
    db.refresh(user)
    return user
