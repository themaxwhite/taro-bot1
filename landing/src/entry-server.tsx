import { renderToString } from "react-dom/server";
import App from "./App";
import { faq } from "./content/faq";
import { seo, siteUrl } from "./seo";

/** Rendered once at build time by scripts/prerender.mjs. The browser bundle
 *  hydrates this markup, so crawlers and no-JS visitors get the full page
 *  instead of an empty <div id="root">. */
export function render() {
  return {
    html: renderToString(<App />),
    head: buildHead(),
  };
}

function buildHead() {
  const url = `${siteUrl}/`;
  const image = `${siteUrl}${seo.ogImage}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Tarot Aurum",
      url,
      inLanguage: "ru-RU",
      description: seo.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Tarot Aurum",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Telegram",
      url,
      image,
      description: seo.description,
      inLanguage: "ru-RU",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RUB",
        availability: "https://schema.org/InStock",
      },
      featureList: [
        "Карта дня",
        "Расклад на любовь",
        "Расклад на будущее",
        "Толкование с учётом вопроса",
        "История раскладов",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ];

  return [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Tarot Aurum — расклады таро в Telegram" />`,
    `<meta name="twitter:image" content="${image}" />`,
    ...jsonLd.map(
      (block) =>
        `<script type="application/ld+json">${JSON.stringify(block).replace(
          /</g,
          "\u003c",
        )}</script>`,
    ),
  ].join("\n    ");
}
