# Tarot Mini App — Backend

## Стек
FastAPI + Pydantic + SQLAlchemy 2.0 + Alembic. Локально — SQLite (`tarot.db`,
один файл, без отдельной установки), в проде `DATABASE_URL` смотрит на
управляемый Postgres. Расклады, подписки и профиль персистятся в БД.

## Запуск

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # при необходимости отредактировать FRONTEND_ORIGINS / DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

Таблицы создаются автоматически при старте (`init_db()` в `app/main.py`).

Проверить: `http://localhost:8000/health` → `{"status": "ok"}`
Документация (Swagger): `http://localhost:8000/docs`

## API

### `POST /api/spreads/draw`

Запрос:
```json
{ "spread_id": "love" }
```

`spread_id`: `"daily-card"` | `"love"` | `"future"` — те же значения, что в
`frontend/src/types/tarot.ts`.

Ответ:
```json
{
  "spread_id": "love",
  "cards": [
    {
      "position": 0,
      "position_label": "Прошлое",
      "card_id": "major-18",
      "name": "Луна",
      "arcana": "major",
      "is_reversed": false
    }
  ]
}
```

Каждый успешный вызов сохраняется в БД (`SpreadRecord`), привязанный к
Telegram-пользователю. Для `"daily-card"` повторный вызов в течение того же
календарного дня (UTC) не тянет новую случайную карту, а возвращает уже
выпавшую — иначе «карта дня» менялась бы на каждое открытие экрана.

### `GET /api/history`
Список раскладов текущего пользователя, новые сверху. Пустой массив, если
раскладов ещё не было.

### `GET /api/profile/stats`
```json
{ "total_spreads": 4, "days_streak": 2 }
```
`days_streak` — число подряд идущих календарных дней (UTC) с хотя бы одним
раскладом, отсчитываемое от сегодня/вчера (в духе Duolingo: если сегодня
расклада ещё не было, но был вчера — серия не сбрасывается).

### `GET /health`
Проверка живости сервиса.

## Архитектурный принцип
Весь выбор карт, случайность и ориентация — исключительно в `app/tarot/engine.py`
(`TarotEngine`). Frontend никогда не решает, какая карта выпала — только
отображает то, что вернул этот эндпоинт.

## Telegram initData
Все эндпоинты, кроме `/health`, ожидают заголовок `X-Telegram-Init-Data` (сырую
строку `Telegram.WebApp.initData` с фронтенда). Backend проверяет HMAC-SHA256
подпись и свежесть `auth_date` (см. `app/telegram/auth.py`), затем находит
или создаёт запись пользователя в БД (`app/api/deps.py::get_current_user`).

**Dev-режим:** если `TELEGRAM_BOT_TOKEN` не задан в `.env`, валидация
полностью пропускается, а все запросы атрибутируются фиксированному
служебному пользователю (id `0`) — это позволяет тестировать API и историю
через `/docs`/браузер без реального бота. В продакшене `TELEGRAM_BOT_TOKEN`
обязателен — без него любой сможет обращаться к API без проверки личности,
и все запросы будут писаться в один и тот же `Dev User`.

## Миграции

Схемой управляет Alembic — файлы в `alembic/versions/`. URL берётся из
`app.config.settings`, не из `alembic.ini`, поэтому база у приложения и у
миграций всегда одна и та же.

Миграции применяются автоматически при старте приложения
(`app/db.py::init_db`), отдельная команда при деплое не нужна. Логика такая:

- **чистая база** — накатывается всё с нуля до `head`;
- **база, созданная до Alembic** (есть таблицы, нет `alembic_version`) —
  сначала одноразовый прогон старого патчера колонок `_ADDED_COLUMNS`, затем
  `stamp 0001_baseline`, затем обычный `upgrade head`. Стампится именно
  baseline, а не `head`, чтобы `0002` реально отработала и дорасширила
  id-колонки до BIGINT, если старый код не успел этого сделать;
- **уже размеченная база** — просто `upgrade head`.

Если миграция не смогла взять блокировку (`lock_timeout`), приложение это
переживает: ревизия остаётся неприменённой, в лог уходит warning, приложение
стартует и обслуживает запросы, а следующий деплой пробует снова. Это
осознанно — предыдущая версия расширения колонок работала без таймаута и
однажды подвесила деплой на пять минут, положив всех пользователей в 502.

Добавить миграцию:

```bash
python -m alembic revision --autogenerate -m "что меняем"
python -m alembic upgrade head     # применить локально
python -m alembic check            # модели и миграции не разошлись
```

Список `_ADDED_COLUMNS` в `app/db.py` заморожен — это музейный экспонат для
дорастания старых баз, новые колонки идут только через ревизию.

## Деплой
См. `../DEPLOYMENT.md` — пошаговая инструкция (Railway/Render/Fly.io + Docker).
Только учти: SQLite-файл живёт на диске контейнера — на большинстве PaaS
(Railway/Render/Fly без volume) диск эфемерный и обнуляется при редеплое.
Поэтому в проде `DATABASE_URL` указывает на управляемый Postgres; SQLite
осталась только для локальной разработки.

## Новое: AI-толкование, дневное пожелание, оплата звёздами

### `GET /api/daily-message`
Одна мотивирующая фраза дня, кэшируется на календарные сутки (UTC) в таблице
`daily_messages` — одна и та же для всех пользователей, генерируется через
Gemini или Anthropic API (если задан `GEMINI_API_KEY` или `ANTHROPIC_API_KEY`),
иначе берётся из статичного списка в `app/ai/fallback.py`.

### `POST /api/spreads/{id}/interpret`
Платное подробное AI-толкование конкретного расклада (с учётом вопроса
пользователя и `interests` из профиля). Требует оплаченной записи
`Purchase(product="interpretation")` для этого `spread_record_id` — иначе
`402 Payment Required`. Результат кэшируется на самой записи расклада.

### `POST /api/spreads/{id}/draw-extra`
Платное вытягивание ещё одной карты к уже существующему раскладу. Каждая
дополнительная карта требует своей оплаченной записи
`Purchase(product="extra_card")`.

### `GET/PATCH /api/profile`, `/api/profile/interests`
Чтение и обновление свободного текстового поля «темы» (`interests`),
которое подмешивается в промпт AI-толкования.

### Оплата через Telegram Stars
`POST /api/payments/create-invoice` создаёт `Purchase(status="pending")` и
вызывает Telegram `createInvoiceLink` (валюта `XTR` — Stars, отдельный
провайдер платежей не нужен). Фронтенд открывает ссылку через
`Telegram.WebApp.openInvoice`. Подтверждение оплаты приходит асинхронно на
`POST /api/telegram/webhook` (два апдейта от Telegram: `pre_checkout_query` —
отвечаем `answerPreCheckoutQuery`, и `successful_payment` — помечаем
`Purchase.status = "paid"`). `GET /api/payments/status?payload=...`
позволяет фронтенду дождаться реального подтверждения, а не полагаться
только на клиентский колбэк `openInvoice`.

**Важно:** вебхук нужно один раз зарегистрировать в Telegram через
`setWebhook` (см. `DEPLOYMENT.md`, раздел про платежи) — без этого
`successful_payment` никогда не дойдёт до backend, и оплаченные функции
не разблокируются, даже если списание Stars прошло успешно.
