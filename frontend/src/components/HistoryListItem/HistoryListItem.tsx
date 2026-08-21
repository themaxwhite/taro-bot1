import type { HistoryEntry } from "../../types/history";
import styles from "./HistoryListItem.module.css";

interface HistoryListItemProps {
  entry: HistoryEntry;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function HistoryListItem({ entry }: HistoryListItemProps) {
  const cardNames = entry.cards.map((card) => card.name).join(" · ");

  return (
    <div className={styles.item}>
      <div className={styles.info}>
        <span className={styles.title}>{entry.spreadTitle}</span>
        <span className={styles.cards}>{cardNames}</span>
      </div>
      <span className={styles.date}>{formatDate(entry.completedAt)}</span>
    </div>
  );
}
