# Деплой Tarot Mini App

Пошаговая инструкция, чтобы приложение реально открывалось в Telegram.
Всё, что здесь описано, нужно выполнить на твоей стороне — из песочницы
Claude нет доступа к хостингу и сети.

---

## 0. Что нужно до начала
- Аккаунт на любом хостинге для backend (примеры ниже: Railway, Render, Fly.io)
- Аккаунт на Vercel или Netlify для frontend (либо любой другой статический хостинг)
- Telegram-аккаунт для общения с `@BotFather`

---

## 1. Backend

### 1.1 Деплой
Вариант А — **Railway** (проще всего для FastAPI):
1. `railway.app` → New Project → Deploy from GitHub repo → выбрать `backend/`
2. Railway автоматически найдёт `Dockerfile` и соберёт образ
3. В Settings → Variables добавить:
   - `TELEGRAM_BOT_TOKEN` — токен из BotFather (шаг 3)
   - `FRONTEND_ORIGINS` — временно `*`, после деплоя фронтенда заменить на реальный домен (например `https://your-app.vercel.app`)
4. Railway выдаст публичный URL вида `https://xxx.up.railway.app` — это и есть `VITE_API_BASE_URL` для фронтенда

Вариант Б — **Render**: New → Web Service → подключить репозиторий, Root Directory `backend`, Render тоже подхватит `Dockerfile` автоматически. Переменные окружения — там же, в разделе Environment.

Вариант В — **Fly.io**: `fly launch` из папки `backend/` (обнаружит Dockerfile), `fly secrets set TELEGRAM_BOT_TOKEN=... FRONTEND_ORIGINS=...`.

### 1.2 Проверка
Открой `https://<твой-backend-домен>/health` — должно вернуть `{"status": "ok"}`.
Открой `https://<твой-backend-домен>/docs` — Swagger UI с эндпоинтом `/api/spreads/draw`.

---

## 2. Frontend

### 2.1 Настройка перед билдом
В `frontend/.env` (или прямо в переменных окружения хостинга):
```
VITE_API_BASE_URL=https://<твой-backend-домен>
```

### 2.2 Деплой на Vercel
1. `vercel.com` → New Project → импортировать репозиторий
2. Root Directory: `frontend`
3. Build Command: `npm run build` (определится автоматически как Vite-проект)
4. Output Directory: `dist`
5. Environment Variables: `VITE_API_BASE_URL` = URL backend из шага 1
6. Deploy → получишь `https://your-app.vercel.app`

### 2.3 Деплой на Netlify
Аналогично: Base directory `frontend`, Build command `npm run build`, Publish directory `frontend/dist`, та же env-переменная.

### 2.4 Обнови CORS на backend
Вернись в переменные окружения backend и замени `FRONTEND_ORIGINS=*` на реальный домен фронтенда:
```
FRONTEND_ORIGINS=https://your-app.vercel.app
```
Передеплой backend, чтобы изменение применилось.

---

## 3. Настройка бота в Telegram

1. Написать `@BotFather` → `/newbot` → задать имя и username → получить **токен** (это и есть `TELEGRAM_BOT_TOKEN` из шага 1.1)
2. `/newapp` → выбрать своего бота → указать:
   - Title, Description, иконку (512×512 png)
   - **Web App URL** = адрес фронтенда с Vercel/Netlify (обязательно HTTPS — без этого Mini App не откроется)
3. (Опционально) `/setmenubutton` → указать тот же URL, чтобы кнопка запуска была видна в меню чата с ботом

### 3.1 Включаем оплату Telegram Stars (для «Подробного толкования» и «Ещё карты»)

Stars — встроенная валюта Telegram, отдельный платёжный провайдер не нужен,
но webhook должен реально получать апдейты о платежах:

1. Зарегистрируй webhook (один раз, после деплоя backend):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=https://<твой-backend-домен>/api/telegram/webhook" \
     -d "secret_token=<придумай случайную строку>"
   ```
   Ту же случайную строку пропиши в `TELEGRAM_WEBHOOK_SECRET` на backend.
2. Проверить, что вебхук зарегистрирован: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Учти: Stars-платежи в Mini App работают только внутри настоящего Telegram
   (не в обычном браузере) — `Telegram.WebApp.openInvoice` там просто
   недоступен. Тестировать оплату можно только через реального бота.
4. Цены (`PRICE_INTERPRETATION_STARS`, `PRICE_EXTRA_CARD_STARS`) задаются в
   `.env` backend — по умолчанию 50 и 30 ⭐ соответственно.

---

## 4. Финальная проверка в реальном Telegram
- Открой бота в Telegram (на телефоне — там UX ощущается честнее, чем в Desktop-клиенте)
- Пройди путь: главный экран → выбор расклада → колода → результат
- Проверь, что карты реально приходят с backend (не моки) — если `TELEGRAM_BOT_TOKEN` настроен верно, `initData` провалидируется автоматически
- Проверь тёмную/светлую тему Telegram и safe area на iPhone с "чёлкой"/Dynamic Island

---

## Чек-лист (из исходного анализа)
- [x] Backend: FastAPI + Tarot Engine — готово
- [x] Экран результата, подключённый к API — готово
- [x] Валидация Telegram `initData` — готово
- [x] Персистентность истории (SQLite) — история/профиль читают реальные данные, не моки
- [x] AI-толкование расклада, дневное пожелание — готово (нужен `ANTHROPIC_API_KEY`, иначе статичный fallback)
- [x] Оплата Stars за толкование и доп. карту — готово на backend+frontend
- [ ] Backend задеплоен на хостинг — сделать по разделу 1
- [ ] Frontend задеплоен на хостинг — сделать по разделу 2
- [ ] Бот зарегистрирован в BotFather с HTTPS Web App URL — сделать по разделу 3
- [ ] `FRONTEND_ORIGINS` на backend указывает на реальный домен фронтенда (не `*`) — сделать по разделу 2.4
- [ ] На хостинге backend подключён persistent volume под `tarot.db`, либо
      `DATABASE_URL` указывает на управляемый Postgres — иначе история
      обнулится при следующем деплое (см. `backend/README.md`)
- [ ] Webhook `setWebhook` зарегистрирован для платежей (раздел 3.1) —
      без этого оплата Stars списывается, но фича не разблокируется
