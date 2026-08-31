# Tarot Mini App — Frontend

## Стек
React + TypeScript + Vite, Telegram Mini Apps (через `telegram-web-app.js`, подключён в `index.html`).

## Запуск

```bash
npm install
npm run dev
```

Откроется на `http://localhost:5173`. Для полноценной проверки Telegram-специфичных
вещей (initData, safe area, тема) нужно открывать через Telegram (BotFather → Mini App URL,
или `ngrok`/аналог для локальной разработки).

## Структура

```
src/
├── App.tsx        # состояние текущего экрана и вся навигация
├── pages/         # экраны: Main, Spread, Result, History, HistoryDetail,
│                  #   Profile, Stats, Chat, Guide, Subscription, Referral,
│                  #   Terms, Admin, Onboarding
├── components/    # переиспользуемые куски UI (ScreenHeader, Deck, CardFront, …)
├── content/       # тексты, общие для нескольких экранов (справка, подсказки
│                  #   к раскладам, названия арканов)
├── feedback/      # звук и тактильная отдача: sound.ts, haptics.ts
├── hooks/         # useTelegramUser, useTheme, useReferralCapture,
│                  #   useTelegramBackButton, useTelegramMainButton
├── services/      # HTTP к backend, по одному модулю на область API
└── types/         # общие типы, часть из них обязана совпадать с backend
```

Роутера нет намеренно: навигация — это `useState` с размеченным объединением
в `App.tsx`, и почти весь поток плоский (экран → назад на главную).
Исключения — детали истории и админка, которые возвращают туда, откуда их
открыли. Настоящий роутер имеет смысл заводить, когда появится вложенность
глубже одного уровня или понадобятся ссылки на конкретный экран.

## Telegram-специфика

Приложение старается пользоваться родным интерфейсом клиента, а не рисовать
свой поверх:

- **Кнопка «назад»** — нативная (`WebApp.BackButton`), подключается один раз в
  `App.tsx` через `useTelegramBackButton`. Тот же обработчик уходит и в экран,
  чтобы «куда ведёт назад» не описывалось дважды.
- **Главная кнопка** (`WebApp.MainButton`) — только на последнем шаге
  онбординга: она одна на всё приложение, поэтому её берёт лишь экран с одним
  однозначным действием.
- **Запасной вариант.** Вне Telegram (локальная разработка в браузере) и на
  клиентах старее Bot API 6.1 нативных кнопок нет — тогда экраны рисуют свои,
  как раньше. Решает это `hasNativeBackButton()` / `hasNativeMainButton()`.
- Тема, `safe area` и `initData` берутся из того же `window.Telegram.WebApp`;
  типы описаны в `src/vite-env.d.ts` — намеренно узко, дописываются по мере
  надобности.

## Продакшен-билд
```bash
npm run build
```
Результат — статика в `dist/`, готова к любому статическому хостингу
(Vercel, Netlify, Cloudflare Pages). Не забудь задать `VITE_API_BASE_URL` на
хостинге — без неё фронтенд будет стучаться в `localhost:8000`.

## Деплой
См. `../DEPLOYMENT.md` — пошаговая инструкция, включая настройку бота в BotFather.

## Дальше
- Реальный роутер, если навигация станет глубже (см. выше).
- Тестов нет вообще — ни одного зависимого пакета для них не подключено.
