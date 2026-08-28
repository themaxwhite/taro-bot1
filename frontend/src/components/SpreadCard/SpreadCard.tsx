import type { SpreadType } from "../../types/tarot";
import styles from "./SpreadCard.module.css";

interface SpreadCardProps {
  spread: SpreadType;
  onSelect: (id: SpreadType["id"]) => void;
}

// Purely decorative per-spread glyph — no meaning attached server-side,
// just a quick visual identity for each tile in the grid.
const SPREAD_GLYPHS: Record<SpreadType["id"], string> = {
  "daily-card": "🔮",
  "yes-no": "❓",
  love: "💞",
  future: "🔭",
  "celtic-cross": "🃏",
  horseshoe: "🍀",
  compatibility: "💑",
  work: "💼",
  crossroads: "🔀",
  mirror: "🪞",
  month: "🌙",
};

function cardsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карта";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "карты";
  return "карт";
}

export function SpreadCard({ spread, onSelect }: SpreadCardProps) {
  return (
    <button type="button" className={styles.card} onClick={() => onSelect(spread.id)}>
      <span className={styles.glyph} aria-hidden="true">
        {SPREAD_GLYPHS[spread.id]}
      </span>
      <span className={styles.title}>{spread.title}</span>
      <span className={styles.count}>
        {spread.cardCount} {cardsWord(spread.cardCount)}
      </span>
    </button>
  );
}
