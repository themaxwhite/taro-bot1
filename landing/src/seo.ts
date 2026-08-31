/** Canonical origin of the deployed site. Set VITE_SITE_URL at build time on
 *  the host; the fallback is the domain the site actually runs on. The
 *  Cloudflare Pages subdomain tarot-aurum.pages.dev keeps serving the same
 *  build, so it must never appear in canonical, og:url or the sitemap —
 *  two addresses with identical content compete in search. No trailing slash. */
export const siteUrl = (
  import.meta.env.VITE_SITE_URL ?? "https://taroaurum.online"
).replace(/\/$/, "");

export const seo = {
  title: "Taro Aurum — расклады таро онлайн в Telegram",
  description:
    "Расклады таро в Telegram: 13 раскладов от карты дня до Кельтского креста, чат с тарологом. Иллюстрированная колода из 78 карт, толкование с учётом вашего вопроса, история раскладов. Карта дня бесплатна каждый день.",
  locale: "ru_RU",
  ogImage: "/og.jpg",
} as const;
