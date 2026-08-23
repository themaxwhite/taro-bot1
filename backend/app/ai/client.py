"""
Minimal API clients for the two AI-generated features (daily motivating
message, spread interpretation). Deliberately not using either vendor's
SDK to keep the dependency list small — these are single JSON POSTs.

Gemini is tried first (its free tier needs no billing account, unlike
Anthropic's pay-as-you-go credits), then Anthropic if only that's
configured. Both call sites handle `None`/exceptions by falling back to
static content (see app/ai/fallback.py) — an LLM outage should never
break the main app flow, just make it a bit less personalized for a day.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_GEMINI_MODEL = "gemini-flash-latest"
_GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent"

_ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
# "claude-sonnet-4-6" (the id this used to hardcode) isn't a real model —
# every call silently 404'd and fell back to static content. claude-opus-5
# is the current default per Anthropic's Claude API guidance.
_ANTHROPIC_MODEL = "claude-opus-5"


def is_configured() -> bool:
    return bool(settings.gemini_api_key or settings.anthropic_api_key)


async def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str | None:
    """
    Returns the model's plain-text reply, or None if no API key is
    configured or the call fails for any reason (network, rate limit,
    malformed response — all treated the same: caller falls back).
    """
    if settings.gemini_api_key:
        result = await _generate_via_gemini(system_prompt, user_prompt, max_tokens)
        if result is not None:
            return result
        # Gemini failed (outage, rate limit, ...) — try Anthropic before
        # giving up, instead of dropping straight to static fallback text.
        if settings.anthropic_api_key:
            return await _generate_via_anthropic(system_prompt, user_prompt, max_tokens)
        return None
    if settings.anthropic_api_key:
        return await _generate_via_anthropic(system_prompt, user_prompt, max_tokens)
    return None


async def _generate_via_gemini(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                _GEMINI_URL,
                headers={
                    "x-goog-api-key": settings.gemini_api_key,
                    "content-type": "application/json",
                },
                json={
                    "systemInstruction": {"parts": {"text": system_prompt}},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {"maxOutputTokens": max_tokens},
                },
            )
        response.raise_for_status()
        data = response.json()
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts).strip()
        return text or None
    except Exception:  # noqa: BLE001 — any failure here should degrade, not 500 the request
        logger.exception("Gemini API call failed")
        return None


async def _generate_via_anthropic(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                _ANTHROPIC_API_URL,
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    # Lets the API transparently retry on a fallback model if
                    # claude-opus-5's safety classifier declines the request,
                    # instead of us immediately dropping to static content.
                    "anthropic-beta": "server-side-fallback-2026-07-01",
                    "content-type": "application/json",
                },
                json={
                    "model": _ANTHROPIC_MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                    "fallbacks": "default",
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
