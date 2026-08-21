"""
Minimal Anthropic API client for the two AI-generated features (daily
motivating message, spread interpretation). Deliberately not using the
`anthropic` SDK to keep the dependency list small — this is a single
JSON POST.

Both call sites handle `None`/exceptions by falling back to static
content (see app/ai/fallback.py) — an LLM outage should never break the
main app flow, just make it a bit less personalized for a day.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_API_URL = "https://api.anthropic.com/v1/messages"
_MODEL = "claude-sonnet-4-6"


def is_configured() -> bool:
    return bool(settings.anthropic_api_key)


async def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str | None:
    """
    Returns the model's plain-text reply, or None if the API key isn't
    configured or the call fails for any reason (network, rate limit,
    malformed response — all treated the same: caller falls back).
    """
    if not settings.anthropic_api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                _API_URL,
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": _MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
        response.raise_for_status()
        data = response.json()
        parts = [block["text"] for block in data.get("content", []) if block.get("type") == "text"]
        text = "".join(parts).strip()
        return text or None
    except Exception:  # noqa: BLE001 — any failure here should degrade, not 500 the request
        logger.exception("Anthropic API call failed")
        return None
