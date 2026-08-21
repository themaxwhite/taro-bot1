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
  };
  colorScheme: "light" | "dark";
  viewportHeight: number;
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  openInvoice: (url: string, callback: (status: string) => void) => void;
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
