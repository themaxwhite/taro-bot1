from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# SQLite has no real datetime/timezone type — SQLAlchemy just stores an
# ISO string. Mixing naive and timezone-aware Python datetimes against
# that column produces inconsistent comparisons, so the whole app
# standardizes on naive UTC datetimes (set explicitly in Python, not via
# a DB-side server_default, so behavior doesn't depend on the DB dialect).


class User(Base):
    """
    A Telegram user. Primary key is the real Telegram user id — in dev
    mode (no TELEGRAM_BOT_TOKEN configured, see api/deps.py) requests are
    attributed to a fixed placeholder id (0) so local history/stats are
    still testable end-to-end without a real bot token.
    """

    __tablename__ = "users"

    telegram_id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Free-form, comma-separated topics the user cares about (career,
    # relationships, ...). Optional context fed into the AI interpretation
    # prompt so readings can lean into what the person actually asked for.
    interests: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    spreads: Mapped[list["SpreadRecord"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class SpreadRecord(Base):
    """
    One completed spread draw. `cards_json` stores the already-serialized
    DrawSpreadResponse cards so History can render past spreads without
    re-deriving anything from the (mutable) SPREADS config.
    """

    __tablename__ = "spread_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.telegram_id"))
    spread_id: Mapped[str] = mapped_column(String(64))
    spread_title: Mapped[str] = mapped_column(String(255))
    cards_json: Mapped[str] = mapped_column(String)
    # Set once the paid AI interpretation has been generated for this
    # spread, so it's only ever billed/generated once and can be re-shown
    # for free afterwards (e.g. reopening it from History).
    interpretation: Mapped[str | None] = mapped_column(String, nullable=True)
    question: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="spreads")


class DailyMessage(Base):
    """
    One motivating line shown at the top of the main screen, cached per
    calendar day (UTC) — same idea as the "карта дня" cache in
    api/spreads.py, so it doesn't regenerate (and re-bill an LLM call) on
    every screen open.
    """

    __tablename__ = "daily_messages"

    date: Mapped[str] = mapped_column(String(10), primary_key=True)  # "YYYY-MM-DD"
    text: Mapped[str] = mapped_column(String(500))


class Purchase(Base):
    """
    A Telegram Stars purchase. Created in "pending" status when an invoice
    link is issued; flipped to "paid" by the Telegram webhook once
    `successful_payment` comes in (see app/api/payments.py). The paid
    feature itself checks this table before doing any billable work.
    """

    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    payload: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.telegram_id"))
    product: Mapped[str] = mapped_column(String(32))  # "interpretation" | "extra_card"
    spread_record_id: Mapped[int] = mapped_column(ForeignKey("spread_records.id"))
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | paid
    telegram_payment_charge_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
