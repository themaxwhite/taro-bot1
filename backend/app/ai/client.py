"""
Клиент к языковой модели для двух функций: сообщение дня и толкование
расклада. Намеренно без SDK поставщика — это один POST с JSON.

Поставщик один: Groq. Раньше за ним стоял платный Anthropic, но при
пересчёте стоимости выяснилось, что смысла в нём нет: одно толкование на
Groq стоит около 6 копеек, на Haiku — 45 копеек, на Opus — 2,2 рубля,
а задача одна и та же — абзац текста по готовому промпту. Держать
второго поставщика ради редких сбоев первого значит платить в разы
дороже за те же слова и хранить лишний ключ.

Сбой Groq при этом не ломает приложение: вызов возвращает None, и
вызывающий код показывает статичный текст (app/ai/fallback.py). Толкование
в такие минуты будет безликим, но расклад откроется и энергия не
спишется — списание идёт только после успешного ответа модели.

До Groq первым пробовался Google Gemini и был убран: он начал отвечать
503 на каждый вызов, и каждое толкование оплачивало его полный таймаут,
прежде чем очередь доходила до Groq, который и делал всю работу.
Поставщик, который никогда не отвечает, — это не запасной вариант, а
задержка.
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

def is_configured() -> bool:
    return bool(settings.groq_api_key)


async def generate_text(system_prompt: str, user_prompt: str, max_tokens: int = 400) -> str | None:
    """
    Returns the model's plain-text reply, or None if no API key is
    configured or every configured provider failed (network, rate
    limit, malformed response — all treated the same: try the next
    provider, or fall back to static content if none are left).
    """
    providers = [
        (settings.groq_api_key, _generate_via_groq),
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
