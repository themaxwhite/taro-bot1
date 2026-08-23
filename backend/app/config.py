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
    # message (app/ai/client.py), tried in order: Gemini (free tier, no
    # billing account needed) -> Groq (also free, separate infra/quota
    # from Google — a fallback for when Gemini's free-tier rate limit is
    # hit) -> Anthropic (pay-as-you-go, tried last). All optional for
    # local dev — both features degrade to a static fallback if none are set.
    gemini_api_key: str | None = None
    groq_api_key: str | None = None
    anthropic_api_key: str | None = None

    # ЮKassa (YooKassa) credentials — shopId + secret key from your
    # merchant dashboard (requires a registered business; see
    # DEPLOYMENT.md). Subscription purchases are unavailable (a clear
    # error, not a crash) when either is unset, same pattern as the AI
    # keys above.
    yookassa_shop_id: str | None = None
    yookassa_secret_key: str | None = None

    # A single testing/admin code that grants full subscription access
    # without going through ЮKassa (POST /api/subscriptions/redeem-promo)
    # — meant for the app owner to test paid features in real Telegram
    # before a merchant account exists. Unset disables redemption
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
    # card) skip the subscription-quota check, so they can be tested
    # without wiring up ЮKassa. Must be False (the default) in any real
    # deployment; see app/api/subscriptions.py::require_quota. Set
    # SKIP_PAYMENT_CHECK=true to flip.
    skip_payment_check: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

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
