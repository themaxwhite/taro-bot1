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

    # Anthropic API key for the AI interpretation feature and the daily
    # motivating message (app/ai/client.py). Both features degrade to a
    # static fallback when this isn't set, so it's optional for local dev.
    anthropic_api_key: str | None = None

    # Prices in Telegram Stars (XTR) — Stars are Telegram's own in-app
    # currency, so no external payment-provider account is needed. See
    # app/api/payments.py and DEPLOYMENT.md for the BotFather setup.
    price_interpretation_stars: int = 50
    price_extra_card_stars: int = 30

    # Must match the secret configured on `setWebhook` so the payments
    # webhook (app/api/payments.py) can reject requests that don't
    # actually come from Telegram. Required in production if payments are
    # enabled; left optional so the rest of the app works without it.
    telegram_webhook_secret: str | None = None

    # The Mini App's own URL (your Cloudflare Pages / Vercel domain).
    # Used by the /start bot handler (app/api/payments.py) to send a
    # "launch app" button — this is independent of BotFather's chat menu
    # button, which sometimes needs a manual re-save to pick up changes.
    mini_app_url: str | None = None

    # DEV ONLY — lets /api/spreads/{id}/interpret skip the Purchase check
    # so the paid AI interpretation can be tested without wiring up Stars
    # payments. Must be False (the default) in any real deployment; see
    # app/api/ai.py::interpret_spread. Set SKIP_PAYMENT_CHECK=true to flip.
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
