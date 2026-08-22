import { useState } from "react";
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
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.card} ${card.is_reversed ? styles.reversed : ""}`}
        onClick={() => setZoomed(true)}
        aria-label={`Увеличить карту: ${card.name}`}
      >
        <img
          className={styles.image}
          src={`/cards/${card.card_id}.webp`}
          alt={card.name}
          loading="eager"
        />
      </button>
      <span className={styles.position}>{card.position_label}</span>
      <span className={styles.orientation}>
        {card.is_reversed ? "Перевёрнутое" : "Прямое положение"}
      </span>

      {zoomed && (
        <div
          className={styles.overlay}
          role="button"
          tabIndex={0}
          aria-label="Закрыть увеличенную карту"
          onClick={() => setZoomed(false)}
          onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter") && setZoomed(false)}
        >
          <div className={`${styles.overlayCard} ${card.is_reversed ? styles.reversed : ""}`}>
            <img
              className={styles.overlayImage}
              src={`/cards/${card.card_id}.webp`}
              alt={card.name}
            />
          </div>
          <span className={styles.overlayLabel}>
            {card.position_label}: {card.name}
            {card.is_reversed ? " (перевёрнутая)" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
