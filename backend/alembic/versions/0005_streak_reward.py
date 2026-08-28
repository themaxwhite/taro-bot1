"""Track which streak milestone a user has already been paid for.

The consecutive-day streak was displayed but rewarded nothing. Paying out
at 7 and 30 days (app/streaks.py) needs one bit of memory per user, or
the same milestone would pay again on every spread drawn that day.

Storing the streak *length* rather than a date is what makes the reward
repeatable: a streak shorter than the recorded one is proof the old
streak lapsed, so the thresholds reset by themselves with nothing to
clean up.

On the locking: same reasoning as 0002_bigint_ids and 0003_energy — this
runs from the app's startup hook, so an unbounded wait for the ACCESS
EXCLUSIVE lock that ADD COLUMN needs is an app that never starts and
502s every user. The timeout leaves the revision unapplied, the app
starts anyway, and the next deploy retries it.

Revision ID: 0005_streak_reward
Revises: 0004_daily_story
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005_streak_reward"
down_revision = "0004_daily_story"
branch_labels = None
depends_on = None

_LOCK_TIMEOUT = "5s"


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    # Существующим пользователям 0, а не «столько, сколько они уже
    # находили»: серия у них может идти давно, и разовая выплата за
    # прошлое ничего не удерживает — награда должна быть впереди.
    op.add_column(
        "users",
        sa.Column("streak_reward_day", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "streak_reward_day")
