"""
Alembic environment.

Two things differ from the stock template:

* the URL comes from `app.config.settings`, not from alembic.ini, so there
  is exactly one place that decides which database this talks to;
* `run_migrations_online` reuses the app's own Engine when the app calls
  it during startup (passed in as `config.attributes["engine"]`), instead
  of building a second one — otherwise every deploy would open a
  throwaway connection pool just to check for migrations. Run from the
  `alembic` CLI there is nothing to reuse, so it builds one.
"""

from __future__ import annotations

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.db import Base
from app import models  # noqa: F401  (registers every model on Base.metadata)

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (`alembic upgrade --sql`)."""
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite cannot ALTER a column in place; batch mode rewrites the
        # table instead. Harmless on Postgres, which ignores it.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = config.attributes.get("engine", None)

    if engine is None:
        engine = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
