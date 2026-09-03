"""
Восстановление базы из копии, снятой app/backups.py.

Запуск (из папки backend, с тем же DATABASE_URL, что у приложения):

    python -m scripts.restore_backup taro-aurum-2026-09-03.json.gz

По умолчанию скрипт отказывается работать, если в базе уже есть данные:
восстановление поверх живой базы — это не восстановление, а потеря того,
что накопилось после копии. Осознанная перезапись включается флагом
--replace, и тогда таблицы очищаются перед заливкой.

Порядок таблиц берётся из моделей с учётом внешних ключей: сначала те, на
кого ссылаются, потом ссылающиеся. При очистке порядок обратный.
"""

import argparse
import datetime as dt
import gzip
import json
import sys

from sqlalchemy import Date, DateTime, delete, func, insert, select

from app.db import SessionLocal, engine
from app.models import Base


def _restore_types(table, row: dict) -> dict:
    """
    Возвращает датам их тип. В копии они лежат строками ISO — так их
    сериализует JSON, — а колонкам нужен datetime, иначе драйвер положит
    в поле времени текст.
    """
    restored = dict(row)
    for column in table.columns:
        value = restored.get(column.name)
        if not isinstance(value, str):
            continue
        if isinstance(column.type, DateTime):
            restored[column.name] = dt.datetime.fromisoformat(value)
        elif isinstance(column.type, Date):
            restored[column.name] = dt.date.fromisoformat(value)
    return restored


def main() -> int:
    parser = argparse.ArgumentParser(description="Восстановить базу из копии")
    parser.add_argument("dump", help="файл вида taro-aurum-ГГГГ-ММ-ДД.json.gz")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="очистить существующие данные перед заливкой",
    )
    args = parser.parse_args()

    with gzip.open(args.dump, "rt", encoding="utf-8") as handle:
        payload = json.load(handle)

    tables = payload["tables"]
    print(f"Копия снята {payload.get('taken_at', 'неизвестно когда')}")

    Base.metadata.create_all(engine)
    ordered = Base.metadata.sorted_tables

    db = SessionLocal()
    try:
        occupied = [
            table.name
            for table in ordered
            if db.execute(select(func.count()).select_from(table)).scalar_one()
        ]
        if occupied and not args.replace:
            print(
                "В базе уже есть данные: " + ", ".join(occupied) + ".\n"
                "Заливка поверх затрёт то, что появилось после копии. "
                "Если это и нужно — повторите с --replace.",
                file=sys.stderr,
            )
            return 1

        if occupied:
            for table in reversed(ordered):
                db.execute(delete(table))

        for table in ordered:
            rows = [_restore_types(table, row) for row in tables.get(table.name) or []]
            if rows:
                db.execute(insert(table), rows)
            print(f"  {table.name}: {len(rows)}")

        db.commit()
    finally:
        db.close()

    print("Готово.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
