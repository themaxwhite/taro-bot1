import { useEffect, useRef } from "react";

// BackButton landed in Bot API 6.1. Older clients still expose the
// object, but calling it does nothing except log a warning, so the app
// keeps drawing its own arrow there instead (see ScreenHeader).
const MIN_VERSION = "6.1";

function backButton() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.isVersionAtLeast?.(MIN_VERSION)) {
    return null;
  }
  return webApp.BackButton ?? null;
}

/**
 * True when Telegram will draw the back button itself, which is the
 * signal for a screen not to render its own.
 *
 * Deliberately a plain function, not state: nothing about it can change
 * during a session — either this client supports the button or it never
 * will — so re-rendering on it would be pointless.
 */
export function hasNativeBackButton(): boolean {
  return backButton() !== null;
}

/**
 * Points Telegram's native back button at `onBack`, or hides it when
 * given null (the main screen, which has nowhere to go back to).
 *
 * Meant to be called once, from wherever navigation actually lives,
 * rather than per screen: the button is a single piece of global chrome,
 * and two screens each showing and hiding it on mount/unmount would
 * fight over it during the switch.
 */
export function useTelegramBackButton(onBack: (() => void) | null): void {
  // The handler is usually a fresh arrow function on every render, which
  // would re-run the effect constantly — and each re-run hides and
  // re-shows the button, making it flicker. Keeping it in a ref means
  // the effect only cares about whether the button should be visible at
  // all, while the click still calls the current handler.
  const handlerRef = useRef(onBack);
  handlerRef.current = onBack;

  const visible = onBack !== null;

  useEffect(() => {
    const button = backButton();
    if (!button) {
      return;
    }

    if (!visible) {
      button.hide();
      return;
    }

    const handleClick = () => handlerRef.current?.();
    button.onClick(handleClick);
    button.show();

    return () => {
      button.offClick(handleClick);
      button.hide();
    };
  }, [visible]);
}
