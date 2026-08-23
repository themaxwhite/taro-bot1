import styles from "./ShufflingDeck.module.css";

// Shown for a beat before the deck-selection grid appears — a small
// stack of card backs jittering like a riffle shuffle, so the deck
// feels freshly mixed before the user picks from it (see Deck.tsx).
export function ShufflingDeck() {
  return (
    <div className={styles.wrap}>
      <div className={styles.stack}>
        {Array.from({ length: 5 }, (_, i) => (
          <img key={i} className={styles.card} src="/cards/card-back.webp" alt="" aria-hidden="true" />
        ))}
      </div>
      <p className={styles.label}>Тасуем колоду…</p>
    </div>
  );
}
