import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl


class TelegramAuthError(Exception):
    """Raised when Telegram initData is missing, malformed, or fails signature verification."""


class TelegramUser:
    def __init__(self, id: int, first_name: str, username: str | None = None) -> None:
        self.id = id
        self.first_name = first_name
        self.username = username


def _build_data_check_string(pairs: list[tuple[str, str]]) -> str:
    # Per Telegram's spec: exclude "hash", sort remaining fields
    # alphabetically by key, join as "key=value" with "\n".
    filtered = [(k, v) for k, v in pairs if k != "hash"]
    filtered.sort(key=lambda kv: kv[0])
    return "\n".join(f"{k}={v}" for k, v in filtered)


def validate_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int = 86400,
) -> TelegramUser:
    """
    Validates a Telegram WebApp initData string against the bot token,
    per Telegram's documented HMAC-SHA256 scheme:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

    Raises TelegramAuthError on any failure. Returns the authenticated
    user on success.
    """
    if not init_data:
        raise TelegramAuthError("Missing Telegram init data")

    pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=False)
    data = dict(pairs)

    received_hash = data.get("hash")
    if not received_hash:
        raise TelegramAuthError("Init data is missing 'hash'")

    data_check_string = _build_data_check_string(pairs)

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise TelegramAuthError("Invalid init data signature")

    auth_date_raw = data.get("auth_date")
    if not auth_date_raw or not auth_date_raw.isdigit():
        raise TelegramAuthError("Init data is missing a valid 'auth_date'")

    age_seconds = time.time() - int(auth_date_raw)
    if age_seconds > max_age_seconds:
        raise TelegramAuthError("Init data has expired")

    user_raw = data.get("user")
    if not user_raw:
        raise TelegramAuthError("Init data is missing 'user'")

    try:
        user_json = json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise TelegramAuthError("Init data 'user' field is not valid JSON") from exc

    if "id" not in user_json or "first_name" not in user_json:
        raise TelegramAuthError("Init data 'user' field is missing required keys")

    return TelegramUser(
        id=user_json["id"],
        first_name=user_json["first_name"],
        username=user_json.get("username"),
    )
