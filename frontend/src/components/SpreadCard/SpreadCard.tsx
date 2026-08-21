import type { SpreadType } from "../../types/tarot";
import styles from "./SpreadCard.module.css";

interface SpreadCardProps {
  spread: SpreadType;
  onSelect: (id: SpreadType["id"]) => void;
}

export function SpreadCard({ spread, onSelect }: SpreadCardProps) {
  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(spread.id)}
    >
      <div className={styles.info}>
        <span className={styles.title}>{spread.title}</span>
        <span className={styles.description}>{spread.description}</span>
      </div>
      <span className={styles.count}>{spread.cardCount} 🂠</span>
    </button>
  );
}
