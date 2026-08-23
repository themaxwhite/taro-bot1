import type { HistoryEntry } from "../../types/history";
import styles from "./HistoryListItem.module.css";

interface HistoryListItemProps {
  entry: HistoryEntry;
  onClick: () => void;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

// Show at most 3 thumbnails so a 10-card Кельтский крест reading
// doesn't turn the list row into its own card grid.
const MAX_THUMBNAILS = 3;

export function HistoryListItem({ entry, onClick }: HistoryListItemProps) {
  const cardNames = entry.cards.map((card) => card.name).join(" · ");
  const thumbnails = entry.cards.slice(0, MAX_THUMBNAILS);
  const extraCount = entry.cards.length - thumbnails.length;

  return (
    <button type="button" className={styles.item} onClick={onClick}>
      <div className={styles.thumbnails}>
        {thumbnails.map((card) => (
          <img
            key={card.position}
            className={styles.thumbnail}
            src={`/cards/${card.card_id}.webp`}
            alt=""
            aria-hidden="true"
          />
        ))}
        {extraCount > 0 && <span className={styles.thumbnailExtra}>+{extraCount}</span>}
      </div>

      <div className={styles.info}>
        <span className={styles.title}>{entry.spreadTitle}</span>
        <span className={styles.cards}>{cardNames}</span>
      </div>

      <span className={styles.date}>{formatDate(entry.completedAt)}</span>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </button>
  );
}
