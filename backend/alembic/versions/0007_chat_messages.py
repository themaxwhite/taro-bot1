"""Chat with a tarot reader — one row per turn.

Both sides of the conversation live in one table, told apart by `role`,
which is also the shape the model API expects: history goes back out
without being reshaped.

An index on user_id because every read is "this user's last N turns" and
there is no other way this table is ever queried.

CREATE TABLE takes no lock on anything that exists, so unlike the
ADD COLUMN revisions this one cannot queue behind live traffic. The
lock_timeout is set anyway, for the same reason the others have it: this
runs from the app's startup hook, and a revision that can hang the boot
is a revision that 502s every user.

Revision ID: 0007_chat_messages
Revises: 0006_patron_card
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007_chat_messages"
down_revision = "0006_patron_card"
branch_labels = None
depends_on = None

_LOCK_TIMEOUT = "5s"


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("text", sa.String(length=4000), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.telegram_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_user_id"), "chat_messages", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_chat_messages_user_id"), table_name="chat_messages")
    op.drop_table("chat_messages")
