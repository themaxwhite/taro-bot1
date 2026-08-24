import styles from "./MysticalBackground.module.css";

// Plain Unicode star/moon characters (✨⭐☾...) used to be used here, but
// several of them default to full-color emoji-font rendering — which
// ignores the CSS `color` set on .item entirely, and Telegram's own
// in-client emoji set renders some of them in colors (reportedly red)
// that clash with the app's gold palette. Inline SVGs with
// fill="currentColor" render as plain vector paths, so `.item`'s
// `color: var(--color-accent)` always applies, on every platform.
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

const ICONS = [StarIcon, MoonIcon, StarIcon, MoonIcon, StarIcon, MoonIcon];

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
  // Always render all 12 positions (matching the 12 nth-child left%
  // rules below, which span the full width) — "subtle" mode culls half
  // of them via CSS (.subtle .item:nth-child(odd)) rather than slicing
  // the array in JS. Slicing to the first 6 items here used to leave
  // "subtle" screens with icons only in the left ~63% of the viewport,
  // since nth-child(1..6)'s left% values don't reach the right edge.
  const icons = ICONS.concat(ICONS);
  return (
    <div
      className={density === "subtle" ? `${styles.background} ${styles.subtle}` : styles.background}
      aria-hidden="true"
    >
      {icons.map((Icon, i) => (
        <span key={i} className={styles.item}>
          <Icon />
        </span>
      ))}
    </div>
  );
}
