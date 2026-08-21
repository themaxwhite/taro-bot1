import type { DrawnCard } from "../../types/result";
import { CardArt } from "../CardArt/CardArt";
import styles from "./CardFront.module.css";

interface CardFrontProps {
  card: DrawnCard;
}

export function CardFront({ card }: CardFrontProps) {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${card.is_reversed ? styles.reversed : ""}`}>
        <span className={styles.corner} data-pos="tl" />
        <span className={styles.corner} data-pos="tr" />
        <span className={styles.corner} data-pos="bl" />
        <span className={styles.corner} data-pos="br" />
        <div className={styles.illustration} aria-hidden="true">
          <CardArt cardId={card.card_id} arcana={card.arcana} />
        </div>
        <div className={styles.label}>
          <span className={styles.name}>{card.name}</span>
          <span className={styles.orientation}>
            {card.is_reversed ? "Перевёрнутое" : "Прямое положение"}
          </span>
        </div>
      </div>
      <span className={styles.position}>{card.position_label}</span>
    </div>
  );
}
