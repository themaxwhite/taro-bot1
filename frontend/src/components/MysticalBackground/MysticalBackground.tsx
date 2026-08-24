import styles from "./MysticalBackground.module.css";

const SYMBOLS = ["✨", "⭐", "✦", "☾", "✧", "⋆"];

interface MysticalBackgroundProps {
  // "full" (default) is the original entrance-moment density, for
  // Onboarding/Main. "subtle" halves the glyph count and fades them
  // further, for content screens (Spread/Result/History) where the
  // atmosphere should carry through without competing with the cards
  // and text sitting on top of it.
  density?: "full" | "subtle";
}

// Purely decorative — a handful of tarot/astrology-flavored glyphs that
// drift slowly upward and fade, positioned/timed entirely via CSS
// (nth-child rules) so there's no per-render randomness or JS animation
// loop. Must be placed inside a `position: relative` ancestor with its
// own stacking context (see e.g. MainScreen.module.css's .screen) so
// its negative z-index keeps it behind that ancestor's real content
// instead of behind the whole page.
export function MysticalBackground({ density = "full" }: MysticalBackgroundProps) {
  const symbols = density === "subtle" ? SYMBOLS : SYMBOLS.concat(SYMBOLS);
  return (
    <div
      className={density === "subtle" ? `${styles.background} ${styles.subtle}` : styles.background}
      aria-hidden="true"
    >
      {symbols.map((symbol, i) => (
        <span key={i} className={styles.item}>
          {symbol}
        </span>
      ))}
    </div>
  );
}
