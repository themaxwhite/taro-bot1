"""
Вход в админ-панель через Telegram по OpenID Connect.

Старый виджет входа (тот, что рисовался скриптом telegram-widget.js и
отдавал данные, подписанные токеном бота) Telegram объявил устаревшим: он
ещё показывает кнопку, но на попытку авторизации отвечает словом
"deprecated". Замена — обычный OIDC:
https://oauth.telegram.org/.well-known/openid-configuration

Поток идёт через бэкенд, а не из браузера, и это не выбор стиля: Telegram
принимает обмен кода на токен только с секретом клиента
(token_endpoint_auth_methods = client_secret_basic | client_secret_post),
а секрету в браузере не место.

    панель  →  GET /api/admin/oauth/start
                   бэкенд запоминает state и code_verifier,
                   отправляет браузер на oauth.telegram.org/auth
    Telegram →  GET /api/admin/oauth/callback?code=...&state=...
                   бэкенд меняет код на id_token, проверяет его,
                   сверяет с ADMIN_TELEGRAM_IDS и возвращает браузер
                   в панель с собственным пропуском в адресе

Про проверку подписи id_token. Токен приходит не через браузер, а прямым
ответом token-эндпойнта на наш запрос по TLS, подтверждённый секретом
клиента. В такой ситуации спецификация OIDC (§3.1.3.7) прямо разрешает
опираться на TLS вместо проверки подписи, поэтому здесь мы читаем полезную
нагрузку и сверяем issuer, audience и срок, но не тянем ради подписи
криптографическую зависимость. Если токен когда-нибудь начнёт приходить
через редирект браузера — проверка подписи станет обязательной.
"""

import base64
import binascii
import hashlib
import hmac
import json
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse

from app.admin_session import issue
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/oauth", tags=["admin"])

ISSUER = "https://oauth.telegram.org"
AUTHORIZATION_ENDPOINT = f"{ISSUER}/auth"
TOKEN_ENDPOINT = f"{ISSUER}/token"

# Сколько живёт начатый, но не завершённый вход. Человек за это время
# успевает подтвердить вход в Telegram, а просроченная попытка повторяется
# заново.
FLOW_TTL_SECONDS = 600


def _state_key() -> bytes:
    return hashlib.sha256(((settings.telegram_bot_token or "") + ":oauth-state").encode()).digest()


def _pack_state(verifier: str) -> str:
    """
    Кладёт code_verifier в сам параметр state и подписывает его.

    Раньше пара state → verifier хранилась в словаре в памяти процесса, и
    это оказалось ошибкой: между нажатием кнопки и возвратом из Telegram
    проходит полминуты-минута, и любой перезапуск бэкенда в этот момент —
    выкатка, переезд контейнера, засыпание — стирал память, а вернувшийся
    человек получал «неизвестный state». То же самое сломалось бы и от
    второго экземпляра приложения: запрос ушёл бы в один процесс, а
    вернулся в другой.

    Подпись держит то же, ради чего нужен state: подделать его нельзя, не
    зная токена бота, а метка времени ограничивает срок жизни. Хранить на
    сервере при этом нечего.
    """
    payload = json.dumps({"v": verifier, "t": int(time.time())}, separators=(",", ":"))
    raw = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    signature = hmac.new(_state_key(), raw.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{raw}.{signature}"


def _unpack_state(state: str) -> str | None:
    """Возвращает code_verifier или None, если подпись не сошлась или срок вышел."""
    parts = state.split(".")
    if len(parts) != 2:
        return None
    raw, signature = parts

    expected = hmac.new(_state_key(), raw.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(expected, signature):
        return None

    try:
        payload = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)))
    except (ValueError, binascii.Error):
        return None

    if not isinstance(payload, dict):
        return None
    if time.time() - float(payload.get("t", 0)) > FLOW_TTL_SECONDS:
        return None
    verifier = payload.get("v")
    return verifier if isinstance(verifier, str) else None


def _redirect_uri() -> str:
    """Адрес, на который Telegram вернёт браузер. Должен совпадать с тем,
    что вписан в Redirect URIs в настройках бота, символ в символ."""
    if not settings.backend_public_url:
        raise HTTPException(
            status_code=503,
            detail="BACKEND_PUBLIC_URL is not configured",
        )
    return settings.backend_public_url.rstrip("/") + "/api/admin/oauth/callback"


def _panel_url(fragment: str) -> str:
    base = (settings.admin_panel_url or "").rstrip("/")
    return f"{base}/{fragment}"


@router.get("/start")
def start_login() -> RedirectResponse:
    """Начало входа: панель просто ведёт сюда браузер."""
    if not settings.telegram_oauth_client_id or not settings.telegram_oauth_client_secret:
        raise HTTPException(status_code=503, detail="Telegram OAuth is not configured")

    verifier = secrets.token_urlsafe(48)
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        .decode()
        .rstrip("=")
    )
    state = _pack_state(verifier)

    query = urlencode(
        {
            "client_id": settings.telegram_oauth_client_id,
            "redirect_uri": _redirect_uri(),
            "response_type": "code",
            "scope": "openid profile",
            "state": state,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        }
    )
    return RedirectResponse(f"{AUTHORIZATION_ENDPOINT}?{query}", status_code=302)


def _decode_id_token(id_token: str) -> dict:
    """Читает полезную нагрузку JWT. Подпись здесь не проверяется — см.
    рассуждение в шапке модуля."""
    parts = id_token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=502, detail="Malformed id_token")
    payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=502, detail="Malformed id_token payload") from exc


@router.get("/callback")
async def finish_login(code: str | None = None, state: str | None = None,
                       error: str | None = None) -> RedirectResponse:
    """Возврат из Telegram."""
    if error:
        logger.warning("Telegram OAuth вернул ошибку: %s", error)
        return RedirectResponse(_panel_url("#error=denied"), status_code=302)

    if not code or not state:
        return RedirectResponse(_panel_url("#error=bad_request"), status_code=302)

    verifier = _unpack_state(state)
    if verifier is None:
        # Подпись не сошлась или прошло больше десяти минут.
        logger.warning("Вход отклонён: state не прошёл проверку или истёк")
        return RedirectResponse(_panel_url("#error=expired"), status_code=302)

    # Секрет уходит заголовком Basic, а не полем в теле. Описание сервера
    # (/.well-known/openid-configuration) заявляет оба способа, но на
    # client_secret_post Telegram отвечает 200 и телом без id_token — то
    # есть молча, будто запрос вообще не был опознан. Час ушёл на то,
    # чтобы это увидеть, поэтому оставляю в коде.
    # strip: скопированный из панели ключ легко приезжает с переводом
    # строки или пробелом на конце, а Basic-заголовок такое не прощает —
    # ответ будет invalid_client, неотличимый от честной опечатки.
    client_id = (settings.telegram_oauth_client_id or "").strip()
    client_secret = (settings.telegram_oauth_client_secret or "").strip()
    credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            TOKEN_ENDPOINT,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
                "code_verifier": verifier,
                "client_id": client_id,
            },
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

    if response.status_code != 200:
        logger.error("Обмен кода не удался: %s %s", response.status_code, response.text[:300])
        return RedirectResponse(_panel_url("#error=token"), status_code=302)

    try:
        body = response.json()
    except ValueError:
        logger.error("Token-эндпойнт вернул не JSON: %s", response.text[:200])
        return RedirectResponse(_panel_url("#error=token"), status_code=302)

    id_token = body.get("id_token")
    if not id_token:
        # Пишем состав ответа, но не значения: в нём может лежать
        # access_token, и логу знать его незачем.
        # Длину секрета писать безопасно, а значение — нет. По ней видно
        # самое частое: ключ скопирован не целиком или не скопирован вовсе.
        logger.error(
            "В ответе token-эндпойнта нет id_token. Поля: %s. error=%s %s. "
            "client_id=%s, длина секрета=%d",
            sorted(body.keys()),
            body.get("error"),
            body.get("error_description"),
            client_id,
            len(client_secret),
        )
        return RedirectResponse(_panel_url("#error=token"), status_code=302)

    claims = _decode_id_token(id_token)

    if claims.get("iss") != ISSUER:
        logger.error("Вход отклонён: чужой issuer %r", claims.get("iss"))
        return RedirectResponse(_panel_url("#error=issuer"), status_code=302)

    audience = claims.get("aud")
    audiences = audience if isinstance(audience, list) else [audience]
    if str(client_id) not in [str(a) for a in audiences]:
        logger.error(
            "Вход отклонён: audience %r не совпадает с client_id %s", audience, client_id
        )
        return RedirectResponse(_panel_url("#error=audience"), status_code=302)

    if float(claims.get("exp", 0)) < time.time():
        logger.error("Вход отклонён: id_token просрочен")
        return RedirectResponse(_panel_url("#error=expired_token"), status_code=302)

    raw_subject = str(claims.get("sub", ""))
    if not raw_subject.lstrip("-").isdigit():
        logger.error(
            "Вход отклонён: sub=%r не число. Поля токена: %s",
            raw_subject,
            sorted(claims.keys()),
        )
        return RedirectResponse(_panel_url("#error=subject"), status_code=302)
    telegram_id = int(raw_subject)

    # Проверку «а администратор ли это» делаем здесь, а не только при
    # запросах: получить пропуск не должен даже тот, кому всё равно
    # ответят отказом. Иначе панель откроется и будет показывать ошибки
    # вместо честного «доступа нет».
    if telegram_id not in settings.admin_telegram_id_set:
        logger.warning(
            "Вход отклонён: %s нет в списке администраторов %s",
            telegram_id,
            sorted(settings.admin_telegram_id_set),
        )
        return RedirectResponse(_panel_url("#error=not_admin"), status_code=302)

    logger.info("Вход выполнен: администратор %s", telegram_id)
    session = issue(telegram_id, settings.telegram_bot_token or "")
    name = claims.get("name") or claims.get("given_name") or ""
    fragment = urlencode({"session": session, "name": name})
    return RedirectResponse(_panel_url("#" + fragment), status_code=302)
