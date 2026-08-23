import { useEffect, useState } from "react";
import type { DrawnCard } from "../../types/result";
import styles from "./CardFront.module.css";

interface CardFrontProps {
  card: DrawnCard;
}

const DEAL_STAGGER_MS = 90;
const FLIP_BASE_DELAY_MS = 450;
const FLIP_STAGGER_MS = 150;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Illustrated deck ("Tarot Aurum") — one PNG-derived WebP per card, served
// statically from /public/cards. The artwork already bakes in the card's
// gold border and its (Russian) name, so reversed cards genuinely flip
// the whole image, same as a real physical reversed card — we don't
// duplicate the name as separate text underneath.
export function CardFront({ card }: CardFrontProps) {
  const [zoomed, setZoomed] = useState(false);
  const [dealt, setDealt] = useState(prefersReducedMotion());
  const [revealed, setRevealed] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const dealTimer = setTimeout(() => setDealt(true), card.position * DEAL_STAGGER_MS);
    const flipTimer = setTimeout(
      () => setRevealed(true),
      FLIP_BASE_DELAY_MS + card.position * FLIP_STAGGER_MS,
    );
    return () => {
      clearTimeout(dealTimer);
      clearTimeout(flipTimer);
    };
    // Runs once per card instance (a fresh draw remounts this component via key={card.position}).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`${styles.wrap} ${dealt ? styles.dealt : styles.dealing}`}>
      <button
        type="button"
        className={`${styles.card} ${card.is_reversed ? styles.reversed : ""}`}
        onClick={() => revealed && setZoomed(true)}
        disabled={!revealed}
        aria-label={revealed ? `Увеличить карту: ${card.name}` : "Карта переворачивается"}
      >
        <div className={`${styles.flipScene} ${revealed ? styles.flipped : ""}`}>
          <div className={styles.flipBack}>
            <img className={styles.image} src="/cards/card-back.webp" alt="" aria-hidden="true" />
          </div>
          <div className={styles.flipFront}>
            <img className={styles.image} src={`/cards/${card.card_id}.webp`} alt={card.name} loading="eager" />
          </div>
        </div>
      </button>
      <span className={`${styles.position} ${revealed ? styles.visible : ""}`}>{card.position_label}</span>
      <span className={`${styles.orientation} ${revealed ? styles.visible : ""}`}>
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
