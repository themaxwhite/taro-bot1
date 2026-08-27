"""The daily story shown at the bottom of the main screen.

A brand-new table, so there is nothing to backfill and nothing that can
fail on a populated database. One row per calendar day (UTC), shared by
every user — see models.py::DailyStory.

Revision ID: 0004_daily_story
Revises: 0003_energy
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '0004_daily_story'
down_revision = '0003_energy'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('daily_stories',
    sa.Column('date', sa.String(length=10), nullable=False),
    sa.Column('author', sa.String(length=80), nullable=False),
    sa.Column('spread_title', sa.String(length=80), nullable=False),
    sa.Column('text', sa.String(length=1200), nullable=False),
    sa.PrimaryKeyConstraint('date')
    )


def downgrade() -> None:
    op.drop_table('daily_stories')
