import { useState } from "react";
import { DeckCard } from "../DeckCard/DeckCard";
import { SelectionCounter } from "../SelectionCounter/SelectionCounter";
import styles from "./Deck.module.css";

interface DeckProps {
  /** How many face-down cards to render as the deck (a visual subset, not the real 78-card deck). */
  totalCards: number;
  /** How many cards the current spread requires. */
  requiredCount: number;
  onSelectionComplete: (selectedIndices: number[]) => void;
}

export function Deck({ totalCards, requiredCount, onSelectionComplete }: DeckProps) {
  const [selected, setSelected] = useState<number[]>([]);

  const isComplete = selected.length === requiredCount;

  const toggleCard = (index: number) => {
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
              disabled={selected.length >= requiredCount}
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
