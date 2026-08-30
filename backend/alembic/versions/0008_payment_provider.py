"""Payments stop being ЮKassa-specific.

The column holding the provider's payment id was named after ЮKassa and
declared NOT NULL, neither of which should outlive that integration. It
is renamed to `provider_payment_id` and made nullable, and a `provider`
column records which service handled each row — every existing row is
ЮKassa, which is why that is the server_default.

This runs even though no payment provider is connected right now. The
point is precisely that the schema should not be named after a provider
the app no longer uses, and the next integration should find a table it
can use as-is rather than another rename.

Nullable matters more than it looks. ЮKassa minted a payment id at
creation time, so there was always something to store. Not every
provider does: some name the payment only once it settles, leaving
nothing to store between "user clicked pay" and "payment arrived", and a
placeholder would collide with the unique index the moment two payments
were pending at once.

All three statements are metadata-only on Postgres (a rename, a
DROP NOT NULL, and an ADD COLUMN with a constant default on PG 11+), so
none of them rewrites the table. The lock_timeout is set for the same
reason as the other revisions: this runs from the app's startup hook,
and a revision that can hang the boot is a revision that 502s every user.

Revision ID: 0008_payment_provider
Revises: 0007_chat_messages
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0008_payment_provider"
down_revision = "0007_chat_messages"
branch_labels = None
depends_on = None

_LOCK_TIMEOUT = "5s"

_OLD_INDEX = "ix_subscription_payments_yookassa_payment_id"
_NEW_INDEX = "ix_subscription_payments_provider_payment_id"


def upgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    op.drop_index(_OLD_INDEX, table_name="subscription_payments")
    with op.batch_alter_table("subscription_payments") as batch_op:
        batch_op.add_column(
            sa.Column("provider", sa.String(length=16), nullable=False, server_default="yookassa")
        )
        batch_op.alter_column(
            "yookassa_payment_id",
            new_column_name="provider_payment_id",
            existing_type=sa.String(length=64),
            existing_nullable=False,
            nullable=True,
        )
    op.create_index(
        _NEW_INDEX, "subscription_payments", ["provider_payment_id"], unique=True
    )


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute(sa.text(f"SET LOCAL lock_timeout = '{_LOCK_TIMEOUT}'"))

    # The old schema had no way to say "started, not settled yet", so
    # rows in exactly that state get a synthetic id rather than being
    # deleted — losing the record that someone began a payment would be
    # worse than a marker that is obviously not a real ЮKassa id.
    op.execute(
        sa.text(
            "UPDATE subscription_payments "
            "SET provider_payment_id = 'unsettled-' || id "
            "WHERE provider_payment_id IS NULL"
        )
    )

    op.drop_index(_NEW_INDEX, table_name="subscription_payments")
    with op.batch_alter_table("subscription_payments") as batch_op:
        batch_op.alter_column(
            "provider_payment_id",
            new_column_name="yookassa_payment_id",
            existing_type=sa.String(length=64),
            existing_nullable=True,
            nullable=False,
        )
        batch_op.drop_column("provider")
    op.create_index(
        _OLD_INDEX, "subscription_payments", ["yookassa_payment_id"], unique=True
    )
