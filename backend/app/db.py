import logging
from collections.abc import Generator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


# `check_same_thread=False` is the standard SQLite/FastAPI combo — each
# request gets its own Session (see `get_db` below), SQLAlchemy handles
# the actual thread safety at the connection-pool level.
_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=_connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

# The revision that reproduces the schema as `create_all` used to build
# it. A database that predates Alembic is stamped with exactly this and
# nothing further, so that every later revision still runs against it.
_BASELINE_REVISION = "0001_baseline"

# Any table that only ever existed post-`create_all` would do; `users` is
# simply the oldest one.
_SENTINEL_TABLE = "users"


def init_db() -> None:
    """
    Brings the database up to the current schema, then clears out cached
    rows known to be broken.

    Runs on every startup. On a fresh database this creates everything
    from scratch; on one that already existed before Alembic was
    introduced it is baselined first (see `_baseline_pre_alembic_database`)
    so the migration history starts from what is actually on disk.
    """
    from app import models  # noqa: F401  (ensure models are registered on Base)

    _baseline_pre_alembic_database()
    _run_migrations()
    _clear_truncated_daily_messages()


def _alembic_config() -> Config:
    config = Config(str(_ALEMBIC_INI))
    # Reuse the app's Engine rather than letting env.py open a second
    # connection pool on every startup.
    config.attributes["engine"] = engine
    return config


def _baseline_pre_alembic_database() -> None:
    """
    Adopts a database created before Alembic existed.

    Such a database has all the app's tables but no `alembic_version`, so
    running the migrations against it would try to create tables that are
    already there. Stamping it with the baseline says "this schema is
    already at revision 0001" without executing it, and later revisions
    then apply normally.

    Before stamping, the old hand-rolled column patcher gets one final
    run. Without it, a database old enough to be missing one of the
    columns in `_ADDED_COLUMNS` would be declared up to date while
    silently lacking it — the patcher was the only thing that had ever
    added them, and stamping would retire it. After this has run once,
    the database has an `alembic_version` row and none of this executes
    again.
    """
    inspector = inspect(engine)
    if not inspector.has_table(_SENTINEL_TABLE) or inspector.has_table("alembic_version"):
        return

    logger.info("Database predates Alembic — catching up columns, then stamping %s.", _BASELINE_REVISION)
    _add_missing_columns()
    command.stamp(_alembic_config(), _BASELINE_REVISION)


def _run_migrations() -> None:
    """
    Upgrades to the newest revision.

    A lock timeout is not fatal: `0002_bigint_ids` deliberately gives up
    rather than queue behind live traffic on a table, since the ALTER it
    wants takes an ACCESS EXCLUSIVE lock and an earlier, timeout-free
    version of that logic once hung a deploy for five minutes and 502'd
    every user. Giving up leaves the revision unapplied, so the next
    deploy simply tries again — and in the meantime the app starts and
    serves normally. Anything else is a real problem and is left to
    propagate.
    """
    try:
        command.upgrade(_alembic_config(), "head")
    except OperationalError:
        logger.warning(
            "A migration could not get the lock it needed and was rolled back — "
            "most likely concurrent traffic on the table. The app is starting "
            "anyway; the next deploy will retry it.",
            exc_info=True,
        )


# (table, column, DDL type) for columns added to a model after it first
# shipped, back when `create_all` was the whole migration story —
# create_all() only creates missing *tables*, never adds columns to one
# that already exists, so a production row would otherwise be missing
# these forever.
#
# This list is frozen. It exists solely to bring a pre-Alembic database
# up to `_BASELINE_REVISION` on its first startup after this change, and
# runs exactly once per database, ever. New columns are a new revision in
# alembic/versions/ now — do not add to this list.
_ADDED_COLUMNS = [
    ("users", "notifications_enabled", "BOOLEAN DEFAULT FALSE"),
    ("users", "last_notified_date", "VARCHAR(10)"),
    ("users", "referred_by", "INTEGER"),
    ("users", "referral_bonus_quota", "INTEGER DEFAULT 0"),
    ("users", "gender", "VARCHAR(16)"),
    ("users", "zodiac_sign", "VARCHAR(16)"),
    ("users", "energy", "INTEGER DEFAULT 0"),
    ("users", "energy_refreshed_date", "VARCHAR(10)"),
    ("spread_follow_ups", "question_label", "VARCHAR(300) DEFAULT ''"),
]


def _add_missing_columns() -> None:
    """
    Cross-dialect version of "ALTER TABLE ADD COLUMN IF NOT EXISTS" — via
    SQLAlchemy's inspector rather than a dialect-specific PRAGMA/catalog
    query, since this has run against both SQLite (local dev) and
    Postgres (production, since the SQLite-on-an-ephemeral-disk incident).
    """
    inspector = inspect(engine)
    with engine.connect() as conn:
        for table, column, ddl_type in _ADDED_COLUMNS:
            if not inspector.has_table(table):
                continue  # nothing on disk to backfill
            existing = {col["name"] for col in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
        conn.commit()


# Below this length, a cached daily_messages row can only be a
# truncated/broken generation (a real one-sentence motivating message
# is always much longer) — a reasoning model can eat nearly all of a
# small max-tokens budget on hidden "thinking" and leave just "До"
# cached for the whole day, which is what happened in production and is
# why the Groq call caps reasoning_effort. One bad row would stick around, shown to
# every visitor, until its date key rolls over at UTC midnight — this
# clears it out immediately so the next request regenerates it.
_MIN_DAILY_MESSAGE_LENGTH = 20


def _clear_truncated_daily_messages() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("daily_messages"):
        return
    with engine.connect() as conn:
        conn.execute(text(f"DELETE FROM daily_messages WHERE LENGTH(text) < {_MIN_DAILY_MESSAGE_LENGTH}"))
        conn.commit()
