import { useEffect, useState } from "react";

interface TelegramUserState {
  firstName: string | null;
  username: string | null;
  photoUrl: string | null;
}

/**
 * Reads the current Telegram user from window.Telegram.WebApp and runs
 * the standard Mini App bootstrap (ready + expand). Falls back gracefully
 * when opened outside Telegram (e.g. in a regular browser during dev).
 */
export function useTelegramUser(): TelegramUserState {
  const [user, setUser] = useState<TelegramUserState>({
    firstName: null,
    username: null,
    photoUrl: null,
  });

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) {
      return;
    }

    webApp.ready();
    webApp.expand();

    const tgUser = webApp.initDataUnsafe.user;
    if (tgUser) {
      setUser({
        firstName: tgUser.first_name,
        username: tgUser.username ?? null,
        photoUrl: tgUser.photo_url ?? null,
      });
    }
  }, []);

  return user;
}
