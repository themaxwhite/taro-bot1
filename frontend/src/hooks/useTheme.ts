import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tarot-aurum:theme";

function resolveInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to
    // the system preference below instead of crashing.
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

/**
 * Manual light/dark toggle (see index.css's `:root[data-theme="dark"]`
 * token overrides) — defaults to the system preference the first time
 * the app is ever opened, then remembers whatever the user explicitly
 * picks from then on, independent of the OS setting.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // best-effort only — worst case the choice doesn't survive a reload
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
