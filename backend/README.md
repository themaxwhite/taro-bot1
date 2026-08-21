# Tarot Mini App — Backend

## Стек
FastAPI + Pydantic + SQLAlchemy 2.0. SQLite по умолчанию (`tarot.db`, один файл,
без отдельной установки) — расклады и профиль пользователя персистятся в БД.

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

## Не реализовано (следующие шаги)
- Alembic-миграции (сейчас — `create_all` при старте, годится, пока схема не
  меняется на заполненной проде).
- AI-интерпретация расклада.
- Реальные иллюстрации карт.

## Деплой
См. `../DEPLOYMENT.md` — пошаговая инструкция (Railway/Render/Fly.io + Docker).
Только учти: SQLite-файл живёт на диске контейнера — на большинстве PaaS
(Railway/Render/Fly без volume) диск эфемерный и обнуляется при редеплое.
Для реальной эксплуатации либо подключи persistent volume, либо смени
`DATABASE_URL` на управляемый Postgres.

## Новое: AI-толкование, дневное пожелание, оплата звёздами

### `GET /api/daily-message`
Одна мотивирующая фраза дня, кэшируется на календарные сутки (UTC) в таблице
`daily_messages` — одна и та же для всех пользователей, генерируется через
Anthropic API (если задан `ANTHROPIC_API_KEY`), иначе берётся из статичного
списка в `app/ai/fallback.py`.

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
