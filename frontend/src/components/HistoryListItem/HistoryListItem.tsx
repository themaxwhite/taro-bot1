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
  // У закрытого расклада карт в записи нет вовсе — рисуем рубашки по
  // известному количеству и не выдаём названий.
  const thumbnails = entry.unlocked ? entry.cards.slice(0, MAX_THUMBNAILS) : [];
  const backsCount = entry.unlocked ? 0 : Math.min(entry.cardCount, MAX_THUMBNAILS);
  const shownCount = entry.unlocked ? thumbnails.length : backsCount;
  const totalCount = entry.unlocked ? entry.cards.length : entry.cardCount;
  const extraCount = totalCount - shownCount;
  const cardNames = entry.unlocked ? entry.cards.map((card) => card.name).join(" · ") : "Расклад не открыт";

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
        {Array.from({ length: backsCount }, (_, i) => (
          <img key={`back-${i}`} className={styles.thumbnail} src="/cards/card-back.webp" alt="" aria-hidden="true" />
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
