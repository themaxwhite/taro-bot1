import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tarot-aurum:theme";

function resolveInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — falls through to
    // the light default below instead of crashing.
  }
  // Deliberately not reading prefers-color-scheme here — every user
  // starts on light regardless of their system setting, and only ever
  // sees dark after explicitly switching to it via the toggle.
  return "light";
}

/**
 * Manual light/dark toggle (see index.css's `:root[data-theme="dark"]`
 * token overrides) — every user starts on light, then this remembers
 * whatever they explicitly pick from then on via localStorage.
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
