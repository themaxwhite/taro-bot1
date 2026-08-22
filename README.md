# Tarot Mini App

Telegram Mini App с раскладами таро. React/TypeScript/Vite фронтенд +
FastAPI/Python backend.

## Структура
```
frontend/   — React/TS/Vite, все экраны (главный, расклад, результат, история, профиль)
backend/    — FastAPI, Tarot Engine (выбор карт и ориентация — только здесь)
DEPLOYMENT.md — пошаговая инструкция деплоя в реальный Telegram
```

## Архитектурный принцип
Весь выбор карт, случайность и ориентация карты решаются **только** backend'ом
(`backend/app/tarot/engine.py`). Frontend ничего не решает сам — только
отображает то, что вернул API.

## Быстрый старт (локально)

Backend:
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Frontend (в отдельном терминале):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Открыть `http://localhost:5173`. Полноценная проверка Telegram-специфики
(initData, safe area, тема) требует открытия через сам Telegram — см.
`DEPLOYMENT.md`.

## Что реализовано
- Главный экран (с дневным AI-пожеланием), экран расклада/колоды (с полем
  вопроса), экран результата, история, профиль (с полем «темы»)
- Backend: полная колода (78 карт), эндпоинт розыгрыша расклада, валидация
  Telegram `initData`
- Иллюстрированная колода «Tarot Aurum» (78 карт + рубашка) — статика в
  `frontend/public/cards/`, тёмно-бирюзовый + античное золото
- Фоновый эмбиент-звук (синтезируется в браузере через Web Audio API,
  без аудиофайлов) — переключатель на главном экране
- Персистентность в SQLite (`app/models.py`): каждый расклад сохраняется и
  реально отображается в истории и статистике профиля
- «Карта дня» фиксируется на календарные сутки (UTC), а не перевыпадается на
  каждое открытие экрана
- AI-толкование расклада (Gemini или Anthropic API, с учётом вопроса и
  «тем» из профиля) и дневное мотивирующее пожелание — оба со статичным
  fallback, если ни `GEMINI_API_KEY`, ни `ANTHROPIC_API_KEY` не настроены
- Оплата через Telegram Stars: подробное толкование и вытягивание
  дополнительной карты — платные, с реальным подтверждением через
  Telegram-вебхук, а не только на доверии к клиенту

## Что дальше
- Alembic-миграции вместо `create_all` при старте
- Persistent volume / managed Postgres для продакшен-деплоя (см. предупреждение
  в `backend/README.md` про эфемерный диск на большинстве PaaS)
- Настройка вебхука Stars-платежей (`DEPLOYMENT.md`, раздел 3.1) —
  без неё оплата списывается, но фича не разблокируется
- Нативные `WebApp.BackButton`/`MainButton` вместо кастомных кнопок
- Поддержка светлой темы Telegram (`colorScheme`) — сейчас интерфейс всегда тёмный

Подробности по каждой части — в `frontend/README.md` и `backend/README.md`.
Инструкция по запуску в проде — в `DEPLOYMENT.md`.
