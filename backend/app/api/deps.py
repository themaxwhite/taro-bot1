import logging

from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User
from app.admin_session import AdminSessionError, verify as verify_admin_session
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

    This is the Mini App's way in. The admin panel signs in differently —
    see `get_admin_user` below.

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


def get_admin_user(
    x_admin_session: str | None = Header(default=None, alias="X-Admin-Session"),
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
    db: Session = Depends(get_db),
) -> User:
    """
    Доступ к админским ручкам. Пускает двоих и по-разному:

    * админ-панель на своём домене — по пропуску `X-Admin-Session`,
      который бэкенд выдал после входа через Telegram (app/admin_session.py);
    * экран статистики внутри мини-приложения — по обычному initData.

    Отдельно от `get_current_user` эта зависимость существует по простой
    причине: та при каждом запросе освежает имя и username из данных
    Telegram, а в пропуске панели их нет. Пойди панель через неё — и имя
    администратора в базе затёрлось бы пустотой.

    Права проверяются здесь же: список ADMIN_TELEGRAM_IDS — единственное
    место, где решается, кто администратор.
    """
    if x_admin_session:
        try:
            telegram_id = verify_admin_session(
                x_admin_session, settings.telegram_bot_token or ""
            )
        except AdminSessionError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
    elif x_telegram_init_data:
        if not settings.telegram_bot_token:
            raise HTTPException(
                status_code=503, detail="Server is not configured for authentication"
            )
        try:
            telegram_id = validate_init_data(
                x_telegram_init_data, settings.telegram_bot_token
            ).id
        except TelegramAuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
    else:
        raise HTTPException(status_code=401, detail="Missing admin credentials")

    if telegram_id not in settings.admin_telegram_id_set:
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.get(User, telegram_id)
    if user is None:
        # Администратор ни разу не открывал само приложение, поэтому строки
        # в users нет. Заводить её здесь не будем: админские ручки только
        # читают, и запись ради чтения — лишняя.
        raise HTTPException(
            status_code=404,
            detail="Откройте мини-приложение хотя бы раз — учётной записи ещё нет",
        )
    return user
