"""
Minimal ЮKassa (YooKassa) REST API client — just the two calls the
subscription flow needs. Same philosophy as app/ai/client.py and
app/telegram/bot_api.py: raw httpx calls instead of the vendor SDK, to
keep the dependency list small.

Docs: https://yookassa.ru/developers/api
"""

import uuid

import httpx

from app.config import settings

_API_BASE = "https://api.yookassa.ru/v3"


class YooKassaError(Exception):
    pass


def is_configured() -> bool:
    return bool(settings.yookassa_shop_id and settings.yookassa_secret_key)


def _auth() -> tuple[str, str]:
    if not is_configured():
        raise YooKassaError("YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY are not configured")
    return settings.yookassa_shop_id, settings.yookassa_secret_key  # type: ignore[return-value]


async def create_payment(
    *, amount_rub: int, description: str, return_url: str, metadata: dict
) -> dict:
    """
    Creates a payment with a redirect confirmation flow: the caller sends
    the user to `result["confirmation"]["confirmation_url"]` to pay by
    card/SBP/etc, YooKassa redirects back to `return_url` afterwards, and
    separately calls our webhook once the payment actually settles — the
    redirect is just UX, never treated as proof of payment.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            f"{_API_BASE}/payments",
            auth=_auth(),
            headers={"Idempotence-Key": str(uuid.uuid4())},
            json={
                "amount": {"value": f"{amount_rub:.2f}", "currency": "RUB"},
                "capture": True,
                "confirmation": {"type": "redirect", "return_url": return_url},
                "description": description,
                "metadata": metadata,
            },
        )
    if response.status_code >= 400:
        raise YooKassaError(f"create_payment failed: {response.status_code} {response.text}")
    return response.json()


async def get_payment(payment_id: str) -> dict:
    """
    Re-fetches a payment's authoritative status directly from ЮKassa.
    ЮKassa doesn't sign webhook payloads, so the webhook handler treats
    the notification only as a hint to re-check *this* payment id here,
    rather than trusting the notification body itself.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{_API_BASE}/payments/{payment_id}", auth=_auth())
    if response.status_code >= 400:
        raise YooKassaError(f"get_payment failed: {response.status_code} {response.text}")
    return response.json()
