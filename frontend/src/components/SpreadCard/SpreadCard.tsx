import type { SpreadType } from "../../types/tarot";
import { hapticTap } from "../../feedback/haptics";
import { SpreadIcon } from "../SpreadIcon/SpreadIcon";
import styles from "./SpreadCard.module.css";

interface SpreadCardProps {
  spread: SpreadType;
  onSelect: (id: SpreadType["id"]) => void;
}

function cardsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "карта";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "карты";
  return "карт";
}

export function SpreadCard({ spread, onSelect }: SpreadCardProps) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => {
        hapticTap();
        onSelect(spread.id);
      }}
    >
      <SpreadIcon spreadId={spread.id} className={styles.glyph} />
      <span className={styles.title}>{spread.title}</span>
      <span className={styles.count}>
        {spread.cardCount} {cardsWord(spread.cardCount)}
      </span>
    </button>
  );
}
