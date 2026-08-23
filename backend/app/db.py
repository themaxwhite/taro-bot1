from collections.abc import Generator

from sqlalchemy import create_engine, text
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


# (table, column, DDL type) for columns added to a model after it first
# shipped — create_all() only creates missing *tables*, never adds
# columns to one that already exists, so a production `users` row would
# otherwise be missing these forever. Add an entry here (never remove
# one) whenever a nullable/defaulted column is added to an existing
# model; a real schema change still needs a real migration tool.
_ADDED_COLUMNS = [
    ("users", "notifications_enabled", "BOOLEAN DEFAULT 0"),
    ("users", "last_notified_date", "VARCHAR(10)"),
]


def _add_missing_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return  # Postgres etc. — use a real migration tool instead.

    with engine.connect() as conn:
        for table, column, ddl_type in _ADDED_COLUMNS:
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
        conn.commit()
