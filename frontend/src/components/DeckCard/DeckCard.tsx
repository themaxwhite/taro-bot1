import { useEffect, useState } from "react";
import styles from "./DeckCard.module.css";

interface DeckCardProps {
  isSelected: boolean;
  selectionOrder: number | null;
  disabled: boolean;
  /** Stagger delay (ms) for this card's one-time deal-in animation, or null to skip it (0 is a legitimate delay — the first card — so it can't double as the skip sentinel). */
  dealDelayMs: number | null;
  onClick: () => void;
}

const DEAL_TRANSITION_MS = 380;

type Entrance = "pending" | "dealing" | "done";

export function DeckCard({
  isSelected,
  selectionOrder,
  disabled,
  dealDelayMs,
  onClick,
}: DeckCardProps) {
  const [entrance, setEntrance] = useState<Entrance>(dealDelayMs === null ? "done" : "pending");

  useEffect(() => {
    if (dealDelayMs === null) return;
    const dealTimer = setTimeout(() => setEntrance("dealing"), dealDelayMs);
    // Once the entrance transition has actually finished, drop the
    // .dealing/.dealt classes entirely — they override .card's own
    // (much snappier) transition timing, and left in place forever
    // they'd keep making :active/.selected feel sluggish long after
    // the deal-in moment has passed.
    const doneTimer = setTimeout(() => setEntrance("done"), dealDelayMs + DEAL_TRANSITION_MS);
    return () => {
      clearTimeout(dealTimer);
      clearTimeout(doneTimer);
    };
    // Deliberately runs only once per mount — this schedules a single
    // "deal into place" entrance, not something later prop changes
    // (e.g. Deck's phase moving from "dealing" to "ready") should replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classNames = [
    styles.card,
    entrance === "pending" ? styles.dealPending : "",
    entrance === "dealing" ? styles.dealing : "",
    isSelected ? styles.selected : "",
    disabled && !isSelected ? styles.disabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
      disabled={disabled && !isSelected}
      aria-pressed={isSelected}
      aria-label={isSelected ? `Карта выбрана, позиция ${selectionOrder}` : "Выбрать карту"}
    >
      <span className={styles.pattern} aria-hidden="true">
        <img className={styles.backImage} src="/cards/card-back.webp" alt="" loading="lazy" />
      </span>
      {isSelected && selectionOrder !== null && (
        <span className={styles.badge}>{selectionOrder}</span>
      )}
    </button>
  );
}
