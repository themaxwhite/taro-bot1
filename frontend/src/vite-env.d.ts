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

// The hardware/steering back button Telegram draws in its own header
// (Bot API 6.1+). Registering a handler is not enough to make it appear
// — it has to be show()n, and it stays visible until hidden, including
// across screens, so whoever shows it owns hiding it again.
interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
}

// The single primary button Telegram pins to the bottom of the sheet
// (Bot API 6.0+). There is exactly one per Mini App, so only a screen
// with one unambiguous main action should claim it.
interface TelegramMainButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  setText: (text: string) => void;
  onClick: (callback: () => void) => void;
  offClick: (callback: () => void) => void;
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
  // Bot API version the *client* supports, not the SDK — an old Telegram
  // build silently ignores newer calls, so features added after 6.0 are
  // gated on this (see hooks/useTelegramBackButton.ts).
  version: string;
  isVersionAtLeast: (version: string) => boolean;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  // Bot API 6.1+. Отсутствует в старых клиентах — вызовы закрыты
  // проверкой версии в feedback/haptics.ts.
  HapticFeedback?: TelegramHapticFeedback;
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

interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
