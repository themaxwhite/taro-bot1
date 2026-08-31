import base64
import binascii
import json
import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.telegram.auth import (
    TelegramAuthError,
    TelegramUser,
    validate_init_data,
    validate_login_widget,
)

logger = logging.getLogger(__name__)

_warned_dev_mode = False

# Fixed placeholder id used to attribute requests to *some* user row when
# running without a real bot token, so history/stats stay testable
# end-to-end locally. Real Telegram user ids are always positive, so 0
# can't collide with one.
DEV_MODE_USER_ID = 0


def get_telegram_user(
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
    x_telegram_login_data: str | None = Header(default=None, alias="X-Telegram-Login-Data"),
) -> TelegramUser | None:
    """
    FastAPI dependency that validates the caller's Telegram credentials
    and returns the authenticated user.

    Two headers are accepted, because the same API serves two clients.
    `X-Telegram-Init-Data` is what the Mini App gets from Telegram on
    open. `X-Telegram-Login-Data` is base64-encoded JSON from the Telegram
    Login widget, which is how the admin panel signs in from an ordinary
    browser — see app/telegram/auth.py, the two signatures are computed
    differently. Base64 because the payload carries the user's name, and
    a header cannot hold non-latin characters as-is.

    Dev-mode fallback: validation is skipped (returns None) only when
    TELEGRAM_BOT_TOKEN is missing *and* ALLOW_UNVERIFIED_REQUESTS is set
    explicitly, so the API stays usable via Swagger/curl locally. Without
    that flag a missing token is treated as a broken deployment and every
    request is refused — a typo in an environment variable must not turn
    the whole API into an open one.
    """
    if not settings.telegram_bot_token:
        if not settings.allow_unverified_requests:
            logger.error(
                "TELEGRAM_BOT_TOKEN is not set and ALLOW_UNVERIFIED_REQUESTS is off "
                "— refusing every request instead of serving them unauthenticated."
            )
            raise HTTPException(
                status_code=503,
                detail="Server is not configured for authentication",
            )

        global _warned_dev_mode
        if not _warned_dev_mode:
            logger.warning(
                "TELEGRAM_BOT_TOKEN is not set — skipping initData validation. "
                "This is only safe for local development."
            )
            _warned_dev_mode = True
        return None

    if x_telegram_init_data:
        try:
            return validate_init_data(x_telegram_init_data, settings.telegram_bot_token)
        except TelegramAuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    if x_telegram_login_data:
        try:
            payload = json.loads(base64.b64decode(x_telegram_login_data))
        except (ValueError, binascii.Error) as exc:
            raise HTTPException(
                status_code=401, detail="Malformed Telegram login data"
            ) from exc
        if not isinstance(payload, dict):
            raise HTTPException(status_code=401, detail="Malformed Telegram login data")
        try:
            return validate_login_widget(payload, settings.telegram_bot_token)
        except TelegramAuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    raise HTTPException(status_code=401, detail="Missing Telegram credentials")


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
