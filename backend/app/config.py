from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Backend configuration, loaded from environment variables (or a .env
    file during local development). See .env.example for the full list.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Comma-separated list of allowed frontend origins for CORS.
    # e.g. "https://your-mini-app.vercel.app,http://localhost:5173"
    frontend_origins: str = "http://localhost:5173"

    # Telegram bot token — required later for validating initData.
    # Left optional for now so the tarot engine can be developed/tested
    # without a real bot token configured.
    telegram_bot_token: str | None = None

    # SQLite by default (a single file, zero setup) — swap for a Postgres
    # URL in production if you need concurrent writers or a managed DB.
    database_url: str = "sqlite:///./tarot.db"

    # API keys for the AI interpretation feature and the daily motivating
    # message (app/ai/client.py), tried in order: Groq (free) ->
    # Anthropic (pay-as-you-go, tried last). Both optional for local dev
    # — the features degrade to a static fallback if neither is set.
    groq_api_key: str | None = None
    anthropic_api_key: str | None = None

    # Настроек платёжного провайдера здесь нет намеренно: он не
    # подключён (см. app/api/subscriptions.py). Когда появится, его
    # ключам место именно тут, рядом с ключами AI, и по тому же
    # принципу — необязательные, а функция без них внятно недоступна.

    # A single testing/admin code that grants full subscription access
    # (POST /api/subscriptions/redeem-promo). With no payment provider
    # connected this is the only way to get a quota at all, so treat it
    # as a credential, not a convenience. Unset disables redemption
    # entirely (any code is rejected).
    admin_promo_code: str | None = None

    # Must match the secret configured on `setWebhook` so the Telegram
    # webhook (app/api/payments.py) can reject requests that don't
    # actually come from Telegram. Required in production; left optional
    # so the rest of the app works without it.
    telegram_webhook_secret: str | None = None

    # The Mini App's own URL (your Cloudflare Pages / Vercel domain).
    # Used by the /start bot handler (app/api/payments.py) to send a
    # "launch app" button — this is independent of BotFather's chat menu
    # button, which sometimes needs a manual re-save to pick up changes.
    mini_app_url: str | None = None

    # Bot username and Mini App short name from BotFather (no @, no
    # slashes — e.g. "mytarolo1gbot" and "mytarolog") — used to build the
    # https://t.me/<bot>/<app>?startapp=ref_<id> referral link
    # (app/api/referral.py). This is the only link shape that actually
    # sets Telegram.WebApp.initDataUnsafe.start_param on open; the plain
    # mini_app_url above would just load a normal page.
    telegram_bot_username: str | None = None
    telegram_app_name: str | None = None

    # UTC hour the daily "карта дня" reminder goes out at (see
    # app/notifications.py). 7 UTC ≈ 10:00 in Moscow — a single fixed
    # hour is a simplification (Russia spans many time zones), fine for
    # a first cut.
    daily_notification_hour_utc: int = 7

    # DEV ONLY — lets the paid features (spread interpretation, extra
    # card) skip the subscription-quota check entirely. Must be False
    # (the default) in any real deployment; see
    # app/api/subscriptions.py::require_quota. Set
    # SKIP_PAYMENT_CHECK=true to flip.
    skip_payment_check: bool = False

    # Ссылка на личный чат поддержки — перк тарифа «Магистр». Обычно
    # это https://t.me/<username> оператора или ссылка на чат-бот
    # поддержки. Пока не задана, тариф продаётся, но кнопка чата не
    # показывается: лучше не показать перк, чем показать битую ссылку.
    support_chat_url: str | None = None

    # Comma-separated Telegram user ids allowed to see the admin
    # dashboard (app/api/admin.py) — the app owner's own id(s), not a
    # general role system. Empty means no one can access it.
    admin_telegram_ids: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def admin_telegram_id_set(self) -> set[int]:
        return {
            int(raw.strip())
            for raw in self.admin_telegram_ids.split(",")
            if raw.strip().lstrip("-").isdigit()
        }

    @property
    def cors_allow_credentials(self) -> bool:
        # The app authenticates via the `X-Telegram-Init-Data` header, not
        # cookies, so credentialed CORS is never actually needed. This
        # also sidesteps a real footgun: wildcard origin ("*") combined
        # with allow_credentials=True is invalid per the CORS spec, and
        # DEPLOYMENT.md tells you to set FRONTEND_ORIGINS=* temporarily
        # during first deploy.
        return "*" not in self.cors_origins


settings = Settings()
