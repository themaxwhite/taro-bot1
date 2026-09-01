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

    # Ключ Groq для двух функций с языковой моделью: толкование расклада и
    # сообщение дня (app/ai/client.py). Необязателен: без него обе функции
    # отдают статичный текст, остальное приложение работает как обычно.
    groq_api_key: str | None = None

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

    # Работать без проверки подписи Telegram. Нужно только для локальной
    # разработки через Swagger или curl, где настоящего initData взять
    # неоткуда. Раньше этот режим включался сам, стоило TELEGRAM_BOT_TOKEN
    # оказаться пустым, — то есть опечатка в переменной окружения молча
    # открывала весь API кому угодно и приписывала запросы одному
    # пользователю. Теперь режим включается только явно, а без токена
    # бэкенд отвечает 503.
    allow_unverified_requests: bool = False

    # Отдавать Swagger (/docs) и схему OpenAPI. В проде схема API никому
    # снаружи не нужна, поэтому по умолчанию выключено.
    expose_api_docs: bool = False

    # Вход в админ-панель через Telegram по OpenID Connect
    # (app/api/admin_auth.py). Client ID и Client Secret берутся из
    # настроек бота, раздел Login Widget. Без них вход отвечает 503, а
    # всё остальное приложение работает как работало.
    telegram_oauth_client_id: str | None = None
    telegram_oauth_client_secret: str | None = None

    # Куда возвращать браузер после входа — адрес самой панели.
    admin_panel_url: str | None = None

    # Робокасса (app/api/robokassa.py). Пароль #1 подписывает ссылку на
    # оплату, пароль #2 — уведомление о ней; перепутать их легко, а
    # последствия разные: с первым не откроется форма, со вторым
    # отвергнется каждое уведомление. Без логина и пароля #1 приём оплаты
    # отвечает 503, всё остальное приложение работает как работало.
    robokassa_merchant_login: str | None = None
    robokassa_password1: str | None = None
    robokassa_password2: str | None = None
    # Тестовый режим Робокассы: форма открывается, деньги не двигаются.
    # У теста своя пара паролей — их и надо класть в переменные выше,
    # пока режим включён.
    robokassa_test_mode: bool = False

    # Куда вернуть человека из платёжной формы. Прямая ссылка на
    # мини-приложение, а не на сайт: платил он внутри Telegram, туда же и
    # должен вернуться.
    mini_app_return_url: str | None = None

    # Собственный публичный адрес бэкенда. Из него собирается redirect_uri,
    # и он должен совпадать с тем, что вписан в Redirect URIs у бота,
    # символ в символ — Telegram сверяет строкой.
    backend_public_url: str | None = None

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
