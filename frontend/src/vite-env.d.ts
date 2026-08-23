/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Minimal typing for the Telegram Mini Apps SDK (window.Telegram.WebApp).
// Extend as more fields are needed — keep it narrow on purpose.
interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    // Set from a https://t.me/<bot>/<app>?startapp=<value> link — used
    // by the referral program (see hooks/useReferralCapture.ts).
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  openTelegramLink: (url: string) => void;
  safeAreaInset?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
