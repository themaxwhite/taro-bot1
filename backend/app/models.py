from __future__ import annotations

import datetime as dt

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
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

    # BigInteger: plain 32-bit INTEGER overflows for newer Telegram
    # accounts, whose numeric ids now regularly exceed 2^31-1.
    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Free-form, comma-separated topics the user cares about (career,
    # relationships, ...). Optional context fed into the AI interpretation
    # prompt so readings can lean into what the person actually asked for.
    interests: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Opt-in for the daily "карта дня" reminder (see app/notifications.py).
    # `last_notified_date` ("YYYY-MM-DD") guards against sending twice if
    # the scheduler job runs more than once on the same day.
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_notified_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Referral program (see app/api/referral.py). `referred_by` is set once,
    # the first time this user is ever seen with a valid ref_<id> start
    # param — never overwritten afterwards. `referral_bonus_quota` is a
    # pool of free unlocks earned by referring others, spent by
    # require_quota() before it even looks at a paid subscription.
    referred_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.telegram_id"), nullable=True)
    referral_bonus_quota: Mapped[int] = mapped_column(Integer, default=0)
    # Free daily "energy" (see app/api/subscriptions.py::require_quota) —
    # refills to DAILY_FREE_ENERGY on the first paid-feature request of a
    # new calendar day (UTC) and doesn't carry over, so it's spent first.
    # `energy_refreshed_date` ("YYYY-MM-DD") is the guard that triggers
    # that refill. Note this column is *overwritten* on refill, never
    # incremented — which is exactly why bought energy cannot live here.
    energy: Mapped[int] = mapped_column(Integer, default=0)
    energy_refreshed_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Energy bought outright (app/energy.py::ENERGY_PACKS). Unlike the
    # daily grant above it accumulates and never expires, and unlike a
    # subscription's quota it survives the end of a billing period — so
    # it is deliberately spent last, once everything perishable is gone.
    purchased_energy: Mapped[int] = mapped_column(Integer, default=0)
    # Длина серии дней подряд, за которую уже выдана награда
    # (app/streaks.py::STREAK_REWARDS). Ноль — в текущей серии наград
    # ещё не было. Хранится именно длина, а не дата: если серия короче
    # записанной, значит она успела оборваться и начаться заново, и
    # пороги можно проходить снова.
    streak_reward_day: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # One-time onboarding (gender + zodiac sign), collected before the
    # user ever sees the main menu (see api/history.py::complete_onboarding).
    # Both null until it's done; the frontend gates on that, not on a
    # separate "completed" flag, since there's nothing meaningful to show
    # with only one of the two set.
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    zodiac_sign: Mapped[str | None] = mapped_column(String(16), nullable=True)
    # Карта-покровитель: один из 22 старших арканов, который пользователь
    # выбирает себе сам (api/history.py::update_patron_card). Хранится
    # id карты из app/tarot/cards.py — то же значение, что и в раскладах,
    # чтобы картинку можно было собрать тем же путём. None — не выбрана;
    # это не обязательный шаг и в онбординг он не входит.
    patron_card: Mapped[str | None] = mapped_column(String(32), nullable=True)
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
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"))
    spread_id: Mapped[str] = mapped_column(String(64))
    spread_title: Mapped[str] = mapped_column(String(255))
    cards_json: Mapped[str] = mapped_column(String)
    # Set once the paid AI interpretation has been generated for this
    # spread, so it's only ever billed/generated once and can be re-shown
    # for free afterwards (e.g. reopening it from History).
    interpretation: Mapped[str | None] = mapped_column(String, nullable=True)
    question: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Whether the drawn cards have been paid for and may be shown. False
    # means the API deliberately withholds the card identities (see
    # api/spreads.py) — the engine has already decided them and they are
    # stored here, but nothing about them reaches the client until one
    # unlock is spent. "Карта дня" is created already unlocked, being the
    # one free reading.
    unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="spreads")
    follow_ups: Mapped[list["SpreadFollowUp"]] = relationship(back_populates="record", cascade="all, delete-orphan")


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


class SpreadFollowUp(Base):
    """
    One paid follow-up question ("Какие риски?", "Что в будущем?", ...,
    or — Премиум only — any free-text question) answered in the context
    of an already-interpreted spread. A preset question is generated —
    and billed via require_quota() — at most once per spread, keyed by
    (spread_record_id, question_key); a free-text question always gets
    a fresh, unique question_key (see app/api/ai.py::ask_follow_up) and
    is never deduped, since there's no meaningful notion of "the same"
    free-text question being asked twice. `question_label` is stored
    verbatim at write time (not re-derived from question_key later) so
    a free-text question's actual wording survives being shown again
    from History.
    """

    __tablename__ = "spread_follow_ups"
    __table_args__ = (UniqueConstraint("spread_record_id", "question_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    spread_record_id: Mapped[int] = mapped_column(ForeignKey("spread_records.id"))
    question_key: Mapped[str] = mapped_column(String(32))
    question_label: Mapped[str] = mapped_column(String(300))
    answer: Mapped[str] = mapped_column(String)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    record: Mapped[SpreadRecord] = relationship(back_populates="follow_ups")


class Subscription(Base):
    """
    A user's current monthly subscription — one row per user, overwritten
    on each successful renewal/upgrade. `quota_used` resets to 0 and
    `quota_total`/`period_end` are refreshed whenever a SubscriptionPayment
    settles (see app/api/subscriptions.py). Gates the paid features
    (spread interpretation, extra card) instead of the old per-action
    Telegram Stars purchase.
    """

    __tablename__ = "subscriptions"

    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"), primary_key=True)
    tier: Mapped[str] = mapped_column(String(16))  # "basic" | "plus"
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | expired
    quota_total: Mapped[int] = mapped_column(Integer)
    quota_used: Mapped[int] = mapped_column(Integer, default=0)
    period_end: Mapped[dt.datetime] = mapped_column(DateTime)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow)


class SubscriptionPayment(Base):
    """
    One payment attempt.

    Nothing writes to this table at the moment: no payment provider is
    connected (see app/api/subscriptions.py). It is kept, rather than
    dropped, for two reasons — it holds real payment history from when
    ЮKassa was connected, and it is the shape the next provider will
    need, whichever one that turns out to be.

    Covers both things that can be bought: a subscription (`kind` =
    "subscription", `tier` says which one) and a pack of energy (`kind` =
    "energy", `energy_amount` says how much). The table keeps its
    original name because renaming it would mean migrating a table that
    holds real payment history for no functional gain.

    The columns are deliberately provider-agnostic. A row is meant to be
    created in "pending" status before the user is sent off to pay, and
    flipped to "succeeded" only when the provider confirms — never on the
    user merely returning to the app.
    """

    __tablename__ = "subscription_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Which payment provider handled this row. Every existing row is
    # "yookassa", from before the integration was removed — hence the
    # server_default. There is intentionally no Python-side default: the
    # next provider must name itself explicitly, because an id means
    # nothing without knowing who issued it.
    provider: Mapped[str] = mapped_column(String(16), server_default="yookassa")
    # The provider's own id for this payment, nullable because not every
    # provider has one to give at the moment a payment starts: ЮKassa
    # minted an id up front, others only name the payment once it
    # settles. Until then a row is identified by `id` alone.
    provider_payment_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"))
    # "subscription" | "energy". Existing rows all predate energy packs,
    # hence the default.
    kind: Mapped[str] = mapped_column(String(16), default="subscription")
    # Empty for an energy purchase.
    tier: Mapped[str] = mapped_column(String(16))
    # Units of energy granted once this settles; 0 for a subscription.
    energy_amount: Mapped[int] = mapped_column(Integer, default=0)
    amount_rub: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending | succeeded | canceled
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)


class ChatMessage(Base):
    """
    Одна реплика в чате с тарологом — и вопрос пользователя, и ответ
    модели лежат здесь же, различаясь полем `role`.

    Хранится в базе, а не в памяти клиента, по двум причинам. Диалог
    оплачен энергией, и потерять его при перезапуске мини-приложения
    значило бы отобрать купленное. И он же — контекст для следующего
    вопроса: без сохранённой истории каждый ответ таролога начинался бы
    со знакомства заново.
    """

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"), index=True)
    # "user" | "assistant" — те же роли, что у OpenAI-совместимого API,
    # чтобы история уходила в модель без перекладывания.
    role: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(String(4000))
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)
