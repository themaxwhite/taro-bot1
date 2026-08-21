import type { DrawnCard } from "../../types/result";
import styles from "./CardFront.module.css";

interface CardFrontProps {
  card: DrawnCard;
}

// Illustrated deck ("Tarot Aurum") — one PNG-derived WebP per card, served
// statically from /public/cards. The artwork already bakes in the card's
// gold border and its (Russian) name, so reversed cards genuinely flip
// the whole image, same as a real physical reversed card — we don't
// duplicate the name as separate text underneath.
export function CardFront({ card }: CardFrontProps) {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${card.is_reversed ? styles.reversed : ""}`}>
        <img
          className={styles.image}
          src={`/cards/${card.card_id}.webp`}
          alt={card.name}
          loading="eager"
        />
      </div>
      <span className={styles.position}>{card.position_label}</span>
      <span className={styles.orientation}>
        {card.is_reversed ? "Перевёрнутое" : "Прямое положение"}
      </span>
    </div>
  );
}
