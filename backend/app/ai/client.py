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

import asyncio
import json
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
# Запасной вариант, а не основной: сюда попадают только те запросы, что не
# смог обслужить Groq. Отсюда и выбор модели.
#
# Здесь стоял claude-opus-5 — и это была ошибка масштаба. Одно толкование
# на нём стоит около 2,2 руб., на Haiku 4.5 — около 0,45 руб., а на самом
# Groq — около 6 копеек. При этом задача узкая: один абзац толкования по
# готовому промпту и списку карт, и разницу между Haiku и Opus в ней не
# видно. Раньше это ничего не стоило, потому что ключа Anthropic не было
# вовсе; с закупкой трафика бесплатный уровень Groq упирается в потолок
# (около 120 толкований в сутки), запасной путь начинает срабатывать
# по-настоящему — и цена модели перестаёт быть теоретической.
#
# ("claude-sonnet-4-6", который был здесь до opus-5, вообще не существует
# как модель: каждый вызов молча получал 404 и уходил в статичный текст.)
_ANTHROPIC_MODEL = "claude-haiku-4-5"


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


# --- Чат с тарологом -------------------------------------------------
#
# У чата свой путь к модели, и намеренно только через Groq.
#
# Обычные фичи при отказе Groq уходят на Anthropic, и это правильно:
# толкование должно появиться, а разница в цене одного вызова не
# принципиальна. Чат же — самая частая по числу вызовов вещь в
# приложении, и тихий переход на платный ключ означал бы счёт, которого
# никто не заказывал. Поэтому здесь при упоре в лимит мы ждём и пробуем
# снова: пусть ответ придёт позже, но по бесплатному тарифу.

# Больше общего таймаута: собеседнику простительно подумать, а обрыв на
# десятой секунде выглядел бы поломкой.
_CHAT_TIMEOUT = 30.0
# Groq на бесплатном тарифе отвечает 429, когда лимит исчерпан. Пауза
# растёт, чтобы вторая попытка не пришла в ту же занятую секунду.
_CHAT_RETRY_DELAYS = (2.0, 5.0)


async def generate_chat_reply(
    system_prompt: str,
    messages: list[dict[str, str]],
    max_tokens: int = 500,
) -> str | None:
    """
    Ответ таролога на диалог целиком. None — если ключа нет или Groq не
    ответил даже после повторов.

    `messages` — история в формате OpenAI ({"role": ..., "content": ...}),
    последним идёт свежий вопрос пользователя.
    """
    if not settings.groq_api_key:
        return None

    for attempt, delay in enumerate((*_CHAT_RETRY_DELAYS, None)):
        try:
            async with httpx.AsyncClient(timeout=_CHAT_TIMEOUT) as client:
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
                        "messages": [{"role": "system", "content": system_prompt}, *messages],
                    },
                )

            # Ждём и пробуем снова только на исчерпанном лимите. Прочие
            # ошибки повтором не лечатся — они повторятся так же.
            if response.status_code == 429 and delay is not None:
                logger.warning("Groq rate limit on chat, retrying in %ss (attempt %s)", delay, attempt + 1)
                await asyncio.sleep(delay)
                continue

            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"].strip()
            return text or None
        except Exception:  # noqa: BLE001 — чат не должен ронять запрос
            logger.exception("Groq chat call failed")
            return None
    return None


async def stream_chat_reply(
    system_prompt: str,
    messages: list[dict[str, str]],
    max_tokens: int = 500,
):
    """
    То же, что generate_chat_reply, но текст отдаётся кусками по мере
    генерации.

    Смысл именно в ощущении времени. Ответ целиком приходит за несколько
    секунд, а на бесплатном тарифе бывает и дольше; первые слова при этом
    готовы почти сразу. Дождаться всего и потом «печатать» на экране —
    значит сложить два ожидания вместо того, чтобы убрать одно.

    Генератор бросает RuntimeError, если поток оборвался или Groq не
    ответил: вызывающая сторона по этому признаку решает, брать ли плату.
    """
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY не задан")

    for delay in (*_CHAT_RETRY_DELAYS, None):
        try:
            async with httpx.AsyncClient(timeout=_CHAT_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    _GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "content-type": "application/json",
                    },
                    json={
                        "model": _GROQ_MODEL,
                        "max_tokens": max_tokens,
                        "reasoning_effort": _GROQ_REASONING_EFFORT,
                        "stream": True,
                        "messages": [{"role": "system", "content": system_prompt}, *messages],
                    },
                ) as response:
                    # Ждём и пробуем снова только на исчерпанном лимите —
                    # остальные ошибки повтором не лечатся.
                    if response.status_code == 429 and delay is not None:
                        logger.warning("Groq rate limit on chat stream, retrying in %ss", delay)
                        await asyncio.sleep(delay)
                        continue
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = line[6:].strip()
                        if payload == "[DONE]":
                            return
                        try:
                            delta = json.loads(payload)["choices"][0].get("delta", {})
                        except (ValueError, KeyError, IndexError):
                            # Один битый кусок не повод рвать весь ответ.
                            continue
                        piece = delta.get("content")
                        if piece:
                            yield piece
                    return
        except Exception as exc:  # noqa: BLE001
            logger.exception("Groq chat stream failed")
            raise RuntimeError("поток от Groq оборвался") from exc

    raise RuntimeError("Groq не ответил после повторов")
