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
} as const;
