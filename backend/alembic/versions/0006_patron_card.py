"""Let a user choose a patron card from the Major Arcana.

A nullable column with no default: the card is a deliberate choice, and
NULL says "not chosen yet" — which is different from, and must not be
faked as, any particular card.

On the locking: same reasoning as 0002/0003/0005 — these run from the
app's startup hook, so an unbounded wait for the ACCESS EXCLUSIVE lock
that ADD COLUMN takes is an app that never starts and 502s every user.
The timeout leaves the revision unapplied, the app starts anyway, and
the next deploy retries it.

Revision ID: 0006_patron_card
Revises: 0005_streak_reward
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006_patron_card"
down_revision = "0005_streak_reward"
branch_labels = None
depends_on = None

_LOCK_TIMEOUT = "5s"


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    op.add_column("users", sa.Column("patron_card", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "patron_card")
