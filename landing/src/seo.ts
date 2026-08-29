/** Canonical origin of the deployed site. Set VITE_SITE_URL at build time on
 *  the host; the fallback is the Cloudflare Pages subdomain. No trailing slash. */
export const siteUrl = (
  import.meta.env.VITE_SITE_URL ?? "https://tarot-aurum.pages.dev"
).replace(/\/$/, "");

export const seo = {
  title: "Tarot Aurum — расклады таро онлайн в Telegram",
  description:
    "Расклады таро в Telegram: 13 раскладов от карты дня до Кельтского креста, чат с тарологом. Иллюстрированная колода из 78 карт, толкование с учётом вашего вопроса, история раскладов. Карта дня бесплатна каждый день.",
  locale: "ru_RU",
  ogImage: "/og.jpg",
} as const;
