"""
Minimal FreeKassa (SCI) client — building the signed payment URL and
verifying the callback that says the payment settled. Same philosophy as
app/ai/client.py and app/telegram/bot_api.py: no vendor SDK, just the
two things the subscription flow actually needs.

Docs: https://docs.freekassa.net/

Note on trust, because it differs from the ЮKassa integration this
replaced. ЮKassa did not sign its webhooks at all, so the old code
treated a notification purely as a hint and re-fetched the payment from
the API before believing anything. FreeKassa *does* sign, with a secret
word only it and we know, and the signature covers the amount and the
order id — the two fields worth forging. So the signature check here is
the proof, and there is no second round-trip. Everything that check
depends on must therefore be exactly right; see verify_callback.

MD5 is FreeKassa's mandated algorithm, not a choice — hence the nosec
-worthy hashlib call below. It is used only to match their signature
scheme, never to store anything.
"""

import hashlib
import hmac
from urllib.parse import urlencode

from app.config import settings

# FreeKassa's current SCI host. The older pay.freekassa.ru still
# resolves and accepts the same parameters, so a redirect landing there
# is not a sign of breakage.
_PAY_URL = "https://pay.fk.money/"

# Addresses FreeKassa sends callbacks from, per their docs. Used only to
# log an eyebrow-raise: behind a PaaS reverse proxy (Railway, Fly) the
# socket address is the proxy's, not FreeKassa's, so rejecting on this
# would break the integration in exactly the environment it ships to.
# The signature is what actually gates settlement.
CALLBACK_IPS = frozenset(
    {"168.119.157.136", "168.119.60.227", "178.154.197.79", "51.250.54.238"}
)

CURRENCY = "RUB"


class FreeKassaError(Exception):
    pass


def is_configured() -> bool:
    return bool(
        settings.freekassa_merchant_id
        and settings.freekassa_secret_word_1
        and settings.freekassa_secret_word_2
    )


def _md5(raw: str) -> str:
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def format_amount(amount_rub: int) -> str:
    """
    The one place the amount becomes text.

    FreeKassa signs the *string* form of the amount, so the value in the
    `oa` parameter and the value inside the signed string have to be
    byte-identical — "599" and "599.00" hash differently and the payment
    page just rejects the signature. Both callers below go through this
    function so they cannot drift apart.
    """
    return f"{amount_rub:.2f}"


def build_payment_url(*, order_id: int, amount_rub: int, email: str | None = None) -> str:
    """
    Builds the URL the user is sent to in order to pay.

    `order_id` is our own SubscriptionPayment.id — FreeKassa requires a
    merchant-unique order number and hands it straight back in the
    callback, which is how the callback finds the row to settle. That is
    also why the payment row has to be written (and flushed, to get an
    id) before this is called.
    """
    if not is_configured():
        raise FreeKassaError("FREEKASSA_MERCHANT_ID / FREEKASSA_SECRET_WORD_1 / _2 are not configured")

    merchant_id = settings.freekassa_merchant_id
    amount = format_amount(amount_rub)
    signature = _md5(
        f"{merchant_id}:{amount}:{settings.freekassa_secret_word_1}:{CURRENCY}:{order_id}"
    )

    params = {
        "m": merchant_id,
        "oa": amount,
        "currency": CURRENCY,
        "o": order_id,
        "s": signature,
    }
    if email:
        params["em"] = email
    return f"{_PAY_URL}?{urlencode(params)}"


def verify_callback(*, merchant_id: str, amount: str, order_id: str, signature: str) -> bool:
    """
    Checks that a callback really came from FreeKassa.

    Two details matter and are easy to get wrong. The signed string uses
    the *second* secret word, not the one that signs the payment URL —
    that separation is the whole point, since the first one is
    effectively public the moment a user looks at the payment link. And
    the amount must be fed back in verbatim as received: FreeKassa
    hashed the exact characters it sent, so re-formatting the value here
    (say, through float) would break every check.

    Comparison is constant-time. The attack it forecloses is remote but
    real — an attacker who can submit callbacks and time the response
    could otherwise recover a valid signature byte by byte.
    """
    if not is_configured():
        return False
    expected = _md5(f"{merchant_id}:{amount}:{settings.freekassa_secret_word_2}:{order_id}")
    return hmac.compare_digest(expected, signature.lower())
