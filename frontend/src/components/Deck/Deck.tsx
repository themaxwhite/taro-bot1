import { useEffect, useState } from "react";
import { DeckCard } from "../DeckCard/DeckCard";
import { SelectionCounter } from "../SelectionCounter/SelectionCounter";
import { ShufflingDeck } from "../ShufflingDeck/ShufflingDeck";
import styles from "./Deck.module.css";

interface DeckProps {
  /** How many face-down cards to render as the deck (a visual subset, not the real 78-card deck). */
  totalCards: number;
  /** How many cards the current spread requires. */
  requiredCount: number;
  onSelectionComplete: (selectedIndices: number[]) => void;
}

const SHUFFLE_DURATION_MS = 1100;
const DEAL_STAGGER_MS = 28;
const DEAL_CARD_DURATION_MS = 380;

type Phase = "shuffling" | "dealing" | "ready";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Deck({ totalCards, requiredCount, onSelectionComplete }: DeckProps) {
  const [selected, setSelected] = useState<number[]>([]);
  // Cards get shuffled, then dealt into the grid, before selection
  // opens up — skipped straight to "ready" if the user has reduced
  // motion turned on, so nothing is gated behind an animation for them.
  const [phase, setPhase] = useState<Phase>(prefersReducedMotion() ? "ready" : "shuffling");

  useEffect(() => {
    if (phase !== "shuffling") return;
    const dealTimer = setTimeout(() => setPhase("dealing"), SHUFFLE_DURATION_MS);
    const readyTimer = setTimeout(
      () => setPhase("ready"),
      SHUFFLE_DURATION_MS + DEAL_STAGGER_MS * totalCards + DEAL_CARD_DURATION_MS,
    );
    return () => {
      clearTimeout(dealTimer);
      clearTimeout(readyTimer);
    };
    // Runs once — a fresh Deck mount (new spread) restarts the sequence via its own new instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isComplete = selected.length === requiredCount;
  const interactionsLocked = phase !== "ready";

  const toggleCard = (index: number) => {
    if (interactionsLocked) return;
    setSelected((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= requiredCount) {
        return prev;
      }
      return [...prev, index];
    });
  };

  const handleContinue = () => {
    if (isComplete) {
      onSelectionComplete(selected);
    }
  };

  if (phase === "shuffling") {
    return (
      <div className={styles.wrapper}>
        <ShufflingDeck />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <SelectionCounter selected={selected.length} required={requiredCount} />

      <div className={styles.grid}>
        {Array.from({ length: totalCards }, (_, index) => {
          const selectionOrder = selected.indexOf(index);
          return (
            <DeckCard
              key={index}
              isSelected={selectionOrder !== -1}
              selectionOrder={selectionOrder === -1 ? null : selectionOrder + 1}
              disabled={interactionsLocked || selected.length >= requiredCount}
              dealDelayMs={phase === "dealing" ? index * DEAL_STAGGER_MS : 0}
              onClick={() => toggleCard(index)}
            />
          );
        })}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.continueButton}
          disabled={!isComplete}
          onClick={handleContinue}
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
