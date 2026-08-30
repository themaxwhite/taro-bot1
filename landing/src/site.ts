/** Everything that changes per deployment lives here, so the page copy never
 *  has to be edited to point the buttons somewhere else. */
export const site = {
  name: "Tarot Aurum",
  tagline: "Расклады таро в Telegram",
  /* Direct Mini App link (bot username + the short app name from BotFather),
     so the button opens the app itself rather than a chat with the bot. */
  botUrl: "https://t.me/mytarolo1gbot/mytarolog",
  botHandle: "@mytarolo1gbot",
  deckSize: 78,

  /* Реквизиты исполнителя. Платёжная система проверяет их наличие на
     сайте при модерации, поэтому они выводятся в подвал и в оферту
     (public/oferta.html — там их нужно вписать вторым местом).
     ЗАПОЛНИТЬ ПЕРЕД ПОДАЧЕЙ ЗАЯВКИ. */
  legalName: "",
  inn: "",
  email: "",
} as const;

/* Реквизиты заполнены? Пока нет — блок исполнителя и ссылка на оферту не
   выводятся вовсе. Показать страницу с надписью «[ФИО полностью]» хуже,
   чем не показать её: модерация читает это как незаполненный шаблон. */
export const hasLegalDetails = Boolean(site.legalName && site.inn && site.email);
