from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


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


def init_db() -> None:
    """
    Creates tables if they don't exist yet. Fine for an MVP with SQLite;
    swap for Alembic migrations once the schema needs to evolve safely
    against a populated production database.
    """
    from app import models  # noqa: F401  (ensure models are registered on Base)

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    _widen_id_columns()


# (table, column, DDL type) for columns added to a model after it first
# shipped — create_all() only creates missing *tables*, never adds
# columns to one that already exists, so a production row would
# otherwise be missing these forever. Add an entry here (never remove
# one) whenever a nullable/defaulted column is added to an existing
# model; a real schema change still needs a real migration tool. The
# DDL type must be valid on both SQLite and Postgres (the two dialects
# this has actually run against) — stick to BOOLEAN/INTEGER/VARCHAR(n)
# with a DEFAULT literal, nothing dialect-specific.
_ADDED_COLUMNS = [
    ("users", "notifications_enabled", "BOOLEAN DEFAULT FALSE"),
    ("users", "last_notified_date", "VARCHAR(10)"),
    ("users", "referred_by", "INTEGER"),
    ("users", "referral_bonus_quota", "INTEGER DEFAULT 0"),
    ("users", "gender", "VARCHAR(16)"),
    ("users", "zodiac_sign", "VARCHAR(16)"),
]


def _add_missing_columns() -> None:
    """
    Cross-dialect version of "ALTER TABLE ADD COLUMN IF NOT EXISTS" — via
    SQLAlchemy's inspector rather than a dialect-specific PRAGMA/catalog
    query, since this now runs against both SQLite (local dev) and
    Postgres (production, since the SQLite-on-an-ephemeral-disk incident).
    """
    inspector = inspect(engine)
    with engine.connect() as conn:
        for table, column, ddl_type in _ADDED_COLUMNS:
            if not inspector.has_table(table):
                continue  # created fresh by create_all() with every current column — nothing to backfill
            existing = {col["name"] for col in inspector.get_columns(table)}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
        conn.commit()


# (table, column) pairs that must be BIGINT — plain INTEGER (Postgres'
# 32-bit default) overflows for newer Telegram user ids, which now
# regularly exceed 2^31-1. SQLite has no fixed-width INTEGER (any
# declared integer type stores up to a full 64-bit signed value), and
# doesn't support ALTER COLUMN at all, so this only ever runs against
# Postgres.
_BIGINT_COLUMNS = [
    ("users", "telegram_id"),
    ("users", "referred_by"),
    ("spread_records", "user_id"),
    ("subscriptions", "user_id"),
    ("subscription_payments", "user_id"),
]


def _widen_id_columns() -> None:
    """Widens id columns created as INTEGER (before this fix) to BIGINT."""
    if engine.dialect.name != "postgresql":
        return
    inspector = inspect(engine)
    with engine.connect() as conn:
        for table, column in _BIGINT_COLUMNS:
            if not inspector.has_table(table):
                continue
            columns = {col["name"]: col for col in inspector.get_columns(table)}
            col_info = columns.get(column)
            if col_info is None or str(col_info["type"]).upper() == "BIGINT":
                continue
            conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE BIGINT"))
        conn.commit()
