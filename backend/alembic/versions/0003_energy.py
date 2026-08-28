"""Energy balance, the spread unlock flag, and the payment kind.

Three additions, all to tables that hold real rows in production, so
every column arrives with a server_default — a bare NOT NULL would fail
outright on the backfill.

`spread_records.unlocked` needs more than a default. It gates whether the
API will reveal a spread's cards, and every reading drawn before this
revision was drawn under rules where the cards were shown for free and
the user has already seen them. Defaulting them to "locked" would
retroactively hide readings out of someone's own history, so existing
rows are explicitly backfilled to unlocked; only new ones start locked.

On the locking: ADD COLUMN takes an ACCESS EXCLUSIVE lock. The column
itself is metadata-only on Postgres 11+ and so is instant once the lock
is held — but acquiring it waits for every in-flight transaction on the
table, and while waiting it blocks new ones from jumping ahead. Since
these migrations run from the app's startup hook, an unbounded wait
means the app never finishes starting and 502s every user, which is what
`lock_timeout` is here to prevent (same reasoning as 0002_bigint_ids: a
timeout leaves the revision unapplied, the app starts anyway, and the
next deploy retries it).

Revision ID: 0003_energy
Revises: 0002_bigint_ids
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_energy"
down_revision = "0002_bigint_ids"
branch_labels = None
depends_on = None


# Same 5s as 0002_bigint_ids — long enough to ride out an ordinary
# request, short enough that a deploy never stalls behind a long one.
_LOCK_TIMEOUT = "5s"


def upgrade() -> None:
    # SET LOCAL, not SET: scoped to this migration's transaction, so it
    # cannot leak onto a pooled connection and fail some later,
    # unrelated write. SQLite has no such setting and needs none — it
    # takes no lock that outlives the statement.
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    # Bought energy: accumulates, never expires, spent after everything
    # perishable. Nobody has any yet, so 0 for every existing user.
    op.add_column(
        "users",
        sa.Column("purchased_energy", sa.Integer(), nullable=False, server_default="0"),
    )

    op.add_column(
        "spread_records",
        sa.Column("unlocked", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Everything drawn before this revision was already visible to its
    # owner. `true` rather than `1` because Postgres will not coerce an
    # integer to boolean here; SQLite has understood the keyword since
    # 3.23, well below what any supported Python ships with.
    op.execute("UPDATE spread_records SET unlocked = true")

    # Every payment that exists today is a subscription purchase.
    op.add_column(
        "subscription_payments",
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="subscription"),
    )
    op.add_column(
        "subscription_payments",
        sa.Column("energy_amount", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("subscription_payments", "energy_amount")
    op.drop_column("subscription_payments", "kind")
    op.drop_column("spread_records", "unlocked")
    op.drop_column("users", "purchased_energy")
