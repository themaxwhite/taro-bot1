# Taro Aurum — лендинг

Одностраничный сайт Telegram Mini App с раскладами таро.

**Живой сайт:** https://tarot-aurum.pages.dev/ (Cloudflare Pages, проект `tarot-aurum`)

## Стек
- **Vite 7** — сборка и дев-сервер
- **React 19 + TypeScript** (strict)
- **Tailwind CSS v4** — через `@tailwindcss/vite`, без `tailwind.config.js`;
  токены темы описаны прямо в `src/index.css`
- **Пререндер** — `react-dom/server` на этапе сборки, в браузере `hydrateRoot`

Ноль рантайм-зависимостей кроме React: анимации на CSS, появление секций и
счётчики на `IntersectionObserver`, золотая пыль на `<canvas>`, иконки —
инлайновый SVG.

## Команды
```bash
npm install
npm run dev      # http://localhost:5173 (без пререндера)
npm run build    # клиент + SSR-бандл + пререндер + robots.txt/sitemap.xml
npm run preview  # проверить прод-сборку
npm run deploy   # сборка и выкатка на Cloudflare Pages
```

`npm run build` состоит из четырёх шагов: `tsc -b`, клиентский `vite build`,
`vite build --ssr src/entry-server.tsx`, затем `node scripts/prerender.mjs` —
он вклеивает отрендеренную разметку и JSON-LD в `dist/index.html`, пишет
`robots.txt` и `sitemap.xml` и удаляет промежуточный `dist-server/`.

## Настройки
| Что | Где |
| --- | --- |
| Ссылка на бота / Mini App | `src/site.ts` → `botUrl` |
| Домен для canonical, sitemap, og:url | `VITE_SITE_URL` (по умолчанию `https://tarot-aurum.pages.dev`) |
| Title, description, og-картинка | `src/seo.ts` и `index.html` |
| Вопросы FAQ (и разметка `FAQPage`) | `src/content/faq.ts` |
| Заголовки кэша и безопасности | `public/_headers` |

Про поисковую оптимизацию и что нужно сделать руками — `SEO.md`.

## Структура
```
scripts/prerender.mjs    # пререндер + robots.txt + sitemap.xml
src/
├── App.tsx              # порядок секций
├── entry-server.tsx     # SSR-рендер и JSON-LD
├── main.tsx             # hydrateRoot / createRoot
├── index.css            # палитра, шрифт, keyframes эффектов
├── site.ts  seo.ts      # константы деплоя
├── content/
│   ├── faq.ts           # общий источник FAQ для секции и разметки
│   ├── readings.ts      # примеры толкований (вопрос → карты → ответ)
│   └── testimonials.ts  # отзывы; PLACEHOLDER=true, пока они заглушки
├── deck.ts              # 15 арканов для демо-расклада
├── hooks/               # useReveal, useTilt, useCountUp, useReducedMotion
└── components/
    ├── primitives.tsx   # Section, Reveal, SectionIntro, кнопка CTA
    ├── Silhouettes.tsx  # фоновые SVG-силуэты с параллаксом
    ├── Atmosphere.tsx   # зерно, виньетка, свет за курсором
    ├── Nav  Hero  Spreads  Readings  DrawCard  HowItWorks
    ├── Deck  Testimonials  Features  Stars  Faq  Footer
    └── GoldDust  ScrollProgress
```

## Тема и анимации
Лендинг сделан в нуар-стиле: почти чёрный фон, золото как единственный тёплый
цвет и холодный стально-синий для мистической половины. Светлой темы здесь
нет намеренно — переключатель убран, палитра описана в `src/index.css`.
Mini App при этом сохраняет свою тёплую пергаментную тему.

Все эффекты — наклон карт за курсором, золотая пыль, зерно, виньетка, свет за
курсором, параллакс силуэтов, лента отзывов, переворот карты, счётчики,
каскадное появление — проверяют `prefers-reduced-motion` и отключаются, не
пряча при этом контент.
