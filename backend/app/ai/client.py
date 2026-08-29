"""
Minimal API clients for the two AI-generated features (daily motivating
message, spread interpretation). Deliberately not using any vendor's
SDK to keep the dependency list small — these are single JSON POSTs.

Tried in order, each only if the previous one is unconfigured or fails:
Groq (free) -> Anthropic (last, since it is pay-as-you-go). Both degrade
to `None` on any failure; callers fall back to static content (see
app/ai/fallback.py) — an LLM outage should never break the main app
flow, just make it a bit less personalized.

Google's Gemini used to be tried first and was removed: it had begun
answering 503 to every call in production, so each interpretation paid
its full timeout before Groq — which was doing all the real work
anyway — even got asked. A provider that never succeeds is not a
fallback, it is latency.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Applies to every phase (connect/read/write) of each provider call.
# Was 20s per provider — a slow or stuck provider made requests wait the
# full timeout before even reaching the next one. A typical successful
# generation (even the ~900-token spread interpretation) finishes in a
# few seconds, so 10s is still generous headroom while capping how long
# one bad provider can stall the whole request.
_REQUEST_TIMEOUT = 10.0

_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
# Groq's lineup changes over time — verified live against the account's
# actual key (GET /v1/models) rather than trusting docs/memory, since
# "llama-3.3-70b-versatile" (an earlier obvious choice) no longer
# exists on it. gpt-oss is a *reasoning* model — it can burn the whole
# max_tokens budget on hidden "thinking" and return empty content
# (confirmed: happened at the default reasoning effort) unless
# reasoning_effort is turned down.
_GROQ_MODEL = "openai/gpt-oss-120b"
_GROQ_REASONING_EFFORT = "low"

_ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
# "claude-sonnet-4-6" (the id this used to hardcode) isn't a real model —
# every call silently 404'd and fell back to static content. claude-opus-5
# is the current default per Anthropic's Claude API guidance.
_ANTHROPIC_MODEL = "claude-opus-5"


def is_configured() -> bool:
    return bool(settings.groq_api_key or settings.anthropic_api_key)


async def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str | None:
    """
    Returns the model's plain-text reply, or None if no API key is
    configured or every configured provider failed (network, rate
    limit, malformed response — all treated the same: try the next
    provider, or fall back to static content if none are left).
    """
    providers = [
        (settings.groq_api_key, _generate_via_groq),
        (settings.anthropic_api_key, _generate_via_anthropic),
    ]
    for api_key, call in providers:
        if not api_key:
            continue
        result = await call(system_prompt, user_prompt, max_tokens)
        if result is not None:
            return result
    return None


async def _generate_via_groq(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(
                _GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": _GROQ_MODEL,
                    "max_tokens": max_tokens,
                    "reasoning_effort": _GROQ_REASONING_EFFORT,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
        response.raise_for_status()
        data = response.json()
        text = data["choices"][0]["message"]["content"].strip()
        return text or None
    except Exception:  # noqa: BLE001 — any failure here should degrade, not 500 the request
        logger.exception("Groq API call failed")
        return None


async def _generate_via_anthropic(system_prompt: str, user_prompt: str, max_tokens: int) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
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
