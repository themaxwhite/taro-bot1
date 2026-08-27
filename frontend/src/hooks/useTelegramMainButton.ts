import { useEffect, useRef } from "react";

function mainButton() {
  return window.Telegram?.WebApp?.MainButton ?? null;
}

/**
 * True when Telegram will draw the main button itself, which is the
 * signal for a screen to skip rendering its own CTA. See
 * hooks/useTelegramBackButton.ts for why this is a function, not state.
 */
export function hasNativeMainButton(): boolean {
  return mainButton() !== null;
}

interface MainButtonOptions {
  text: string;
  onClick: () => void;
  /** Hidden entirely when false — e.g. a step of a flow with no single action. */
  visible?: boolean;
  /** Greyed out and unclickable, for an action whose preconditions aren't met yet. */
  disabled?: boolean;
  /** Replaces the label with Telegram's own spinner while something is in flight. */
  progress?: boolean;
}

/**
 * Drives Telegram's native main button — the one pinned to the bottom of
 * the sheet.
 *
 * There is only one of these in the whole Mini App, so it belongs to a
 * screen with exactly one obvious next action. A screen offering several
 * comparable choices should keep its own in-flow buttons: promoting one
 * of them to the bottom of the sheet would imply a primacy that isn't
 * there, and the rest would still need drawing anyway.
 */
export function useTelegramMainButton({
  text,
  onClick,
  visible = true,
  disabled = false,
  progress = false,
}: MainButtonOptions): void {
  // Same reasoning as useTelegramBackButton: a handler recreated each
  // render must not re-run the show/hide effect.
  const handlerRef = useRef(onClick);
  handlerRef.current = onClick;

  useEffect(() => {
    const button = mainButton();
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

  // The label and the two states are separate effects so that changing
  // one doesn't tear down the click registration.
  useEffect(() => {
    const button = mainButton();
    if (button && visible) {
      button.setText(text);
    }
  }, [text, visible]);

  useEffect(() => {
    const button = mainButton();
    if (!button || !visible) {
      return;
    }
    if (disabled) {
      button.disable();
    } else {
      button.enable();
    }
  }, [disabled, visible]);

  useEffect(() => {
    const button = mainButton();
    if (!button || !visible) {
      return;
    }
    if (progress) {
      button.showProgress();
    } else {
      button.hideProgress();
    }
  }, [progress, visible]);
}
