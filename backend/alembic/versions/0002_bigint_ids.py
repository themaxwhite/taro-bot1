"""Widen the Telegram id columns to BIGINT.

Plain INTEGER is 32-bit on Postgres and overflows for newer Telegram user
ids, which now routinely exceed 2^31-1 — the symptom was that brand-new
users simply could not sign up. Tables created from 0001_baseline already
have BIGINT here; this revision exists for databases that predate that
fix, which are stamped at 0001 and then upgraded through this.

Every column is checked before it is touched, so running this against an
already-correct database is a no-op rather than a rewrite.

SQLite is skipped: it has no fixed-width integer type (any column
declared INTEGER already stores a full 64-bit signed value) and no ALTER
COLUMN at all.

On the locking: ALTER COLUMN TYPE needs an ACCESS EXCLUSIVE lock, which
waits for every in-flight transaction on the table — and while waiting,
blocks new ones from jumping ahead. An earlier version of this logic ran
without a timeout inside the app's startup hook and hung an entire deploy
for five minutes, 502-ing every user, because the app never finished
starting. `lock_timeout` turns that into a fast failure: the revision is
left unapplied, the app starts anyway (see app/db.py::_run_migrations),
and the next deploy retries it.

Revision ID: 0002_bigint_ids
Revises: 0001_baseline
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_bigint_ids"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

# Columns holding a Telegram user id, which is what overflows.
_BIGINT_COLUMNS = [
    ("users", "telegram_id"),
    ("users", "referred_by"),
    ("spread_records", "user_id"),
    ("subscriptions", "user_id"),
    ("subscription_payments", "user_id"),
]

_LOCK_TIMEOUT = "5s"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    inspector = sa.inspect(bind)
    for table, column in _BIGINT_COLUMNS:
        if not inspector.has_table(table):
            continue
        columns = {col["name"]: col for col in inspector.get_columns(table)}
        info = columns.get(column)
        if info is None or str(info["type"]).upper() == "BIGINT":
            continue
        # SET LOCAL, not SET: scoped to this migration's transaction, so
        # it cannot leak onto a pooled connection and make some later,
        # unrelated write fail because it waited >5s for a lock.
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} TYPE BIGINT"))


def downgrade() -> None:
    # Deliberately not implemented. Narrowing back to INTEGER would fail
    # outright on any row whose id is the reason this revision exists.
    raise NotImplementedError("Narrowing Telegram ids back to INTEGER would lose data.")
