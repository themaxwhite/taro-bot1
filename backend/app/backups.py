"""
Ночная копия базы, которая приходит администратору файлом в Telegram.

Зачем это здесь, а не в настройках хостинга: у Railway резервные копии
тома доступны только в тарифе Pro, и до его подключения база жила вообще
без копий. В ней при этом лежит единственный экземпляр того, чего нет
больше нигде, — остатки энергии, действующие подписки, история раскладов
и переписка с тарологом. Платежи и чеки продублированы в кабинете
Робокассы и в «Мой налог», а вот кому сколько энергии осталось, знает
только эта база.

Дамп снимается средствами SQLAlchemy, а не `pg_dump`: клиента Postgres в
образе нет, и тащить его туда ради одной задачи дороже, чем обойти. Цена
такого решения — восстановление не одной командой, а скриптом
(backend/scripts/restore_backup.py), и знание о схеме берётся из моделей,
а не из самой базы: колонка, которой нет в models.py, в копию не попадёт.
Для базы, которая целиком пересобирается из моделей, это приемлемо.

Формат — JSON внутри gzip: он читается глазами, переживает смену версии
Postgres и не зависит от того, чем именно его открывать.
"""

import datetime as dt
import gzip
import json
import logging

import httpx
from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import Base

logger = logging.getLogger(__name__)

# Телеграм принимает от бота документы до 50 МБ. Порог ниже — чтобы
# упереться в него на своей стороне и написать об этом в лог, а не
# получить отказ от API без объяснений.
_MAX_UPLOAD_BYTES = 45 * 1024 * 1024


def _json_safe(value: object) -> object:
    """Даты в JSON не сериализуются — переводим их в строку ISO."""
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    return value


def build_dump() -> tuple[bytes, dict[str, int]]:
    """
    Собирает содержимое всех таблиц в один сжатый JSON.

    Возвращает сам файл и число строк по таблицам — счётчики уходят в
    подпись к файлу, чтобы копию можно было оценить, не распаковывая:
    внезапно опустевшая таблица видна сразу.
    """
    payload: dict[str, list[dict]] = {}
    counts: dict[str, int] = {}

    db = SessionLocal()
    try:
        # Порядок объявления в metadata — это порядок с учётом внешних
        # ключей, в нём же данные и восстанавливаются.
        for table in Base.metadata.sorted_tables:
            rows = [
                {c.name: _json_safe(v) for c, v in zip(table.columns, row)}
                for row in db.execute(select(table)).all()
            ]
            payload[table.name] = rows
            counts[table.name] = len(rows)
    finally:
        db.close()

    body = json.dumps(
        {
            "taken_at": dt.datetime.utcnow().isoformat(timespec="seconds"),
            "tables": payload,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    return gzip.compress(body, compresslevel=9), counts


async def send_backup() -> None:
    """
    Снимает копию и отправляет её первому администратору из
    ADMIN_TELEGRAM_IDS. Задача планировщика — см. app/main.py.

    Любой сбой здесь только пишется в лог: не доехавшая копия не повод
    ронять приложение, но и молчать о ней нельзя — молчаливо не
    работающий бэкап хуже, чем его отсутствие, потому что на него
    рассчитывают.
    """
    if not settings.telegram_bot_token:
        logger.warning("Копия базы не отправлена: не задан TELEGRAM_BOT_TOKEN")
        return

    admins = sorted(settings.admin_telegram_id_set)
    if not admins:
        logger.warning("Копия базы не отправлена: пуст список ADMIN_TELEGRAM_IDS")
        return

    try:
        blob, counts = build_dump()
    except Exception:
        logger.exception("Не удалось снять копию базы")
        return

    if len(blob) > _MAX_UPLOAD_BYTES:
        logger.error(
            "Копия базы весит %.1f МБ — больше, чем принимает Telegram. "
            "Пора складывать копии в хранилище, а не в чат.",
            len(blob) / 1024 / 1024,
        )
        return

    today = dt.datetime.utcnow().strftime("%Y-%m-%d")
    lines = " · ".join(f"{name} {count}" for name, count in counts.items() if count)
    caption = f"Копия базы за {today}\n{lines}\n{len(blob) / 1024:.0f} КБ"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendDocument",
                data={"chat_id": admins[0], "caption": caption},
                files={"document": (f"taro-aurum-{today}.json.gz", blob, "application/gzip")},
            )
        data = response.json()
        if not data.get("ok"):
            logger.error("Telegram отказался принять копию базы: %s", data.get("description"))
            return
    except Exception:
        logger.exception("Сбой при отправке копии базы")
        return

    logger.info("Копия базы отправлена администратору %s, %d байт", admins[0], len(blob))
