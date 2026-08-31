/**
 * Публичная оферта живёт на сайте, а приложение на неё ссылается.
 *
 * Копии внутри приложения намеренно нет: это юридический текст, и две
 * редакции порядка возврата — это два разных обещания покупателю. В
 * проекте уже трижды расходились продублированные данные (цены, список
 * раскладов, картинки карт), и цена ошибки там была несравнимо ниже.
 *
 * При переезде на свой домен адрес меняется здесь и в подвале сайта.
 */
export const OFFER_URL = "https://tarot-aurum.pages.dev/oferta.html";

/** Открывает оферту во встроенном браузере Telegram, вне него — в новой вкладке. */
export function openOffer(): void {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    webApp.openLink(OFFER_URL);
  } else {
    window.open(OFFER_URL, "_blank", "noopener");
  }
}

/**
 * Общая поддержка — одна на всех пользователей.
 *
 * Отдельно от SUPPORT_CHAT_URL на сервере: та переменная отдаёт ссылку
 * только подписчикам «Магистра» как перк тарифа. Эта — публичный адрес,
 * куда может написать любой, и держать его на сервере незачем: он
 * одинаков для всех и не зависит от подписки.
 */
export const SUPPORT_URL = "https://t.me/aurumhelp";

/** Открывает чат поддержки внутри Telegram, а вне него — в новой вкладке. */
export function openSupport(): void {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    // openTelegramLink, а не openLink: ссылка на t.me должна открыться в
    // самом Telegram, а не во встроенном браузере поверх него.
    webApp.openTelegramLink(SUPPORT_URL);
  } else {
    window.open(SUPPORT_URL, "_blank", "noopener");
  }
}
