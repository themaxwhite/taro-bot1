import styles from "./MysticalBackground.module.css";

const SYMBOLS = ["✨", "⭐", "✦", "☾", "✧", "⋆"];

// Purely decorative — a handful of tarot/astrology-flavored glyphs that
// drift slowly upward and fade, positioned/timed entirely via CSS
// (nth-child rules) so there's no per-render randomness or JS animation
// loop. Must be placed inside a `position: relative` ancestor with its
// own stacking context (see e.g. MainScreen.module.css's .screen) so
// its negative z-index keeps it behind that ancestor's real content
// instead of behind the whole page.
export function MysticalBackground() {
  return (
    <div className={styles.background} aria-hidden="true">
      {SYMBOLS.concat(SYMBOLS).map((symbol, i) => (
        <span key={i} className={styles.item}>
          {symbol}
        </span>
      ))}
    </div>
  );
}
