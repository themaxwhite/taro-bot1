import { useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Deck } from "../../components/Deck/Deck";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./SpreadScreen.module.css";

interface SpreadScreenProps {
  spreadId: SpreadId;
  onBack: () => void;
  onCardsSelected: (spreadId: SpreadId, question: string) => void;
}

// Visual deck size — a representative subset shown to the user, not the
// full 78-card tarot deck (keeps the grid usable on small screens).
const VISUAL_DECK_SIZE = 20;

export function SpreadScreen({ spreadId, onBack, onCardsSelected }: SpreadScreenProps) {
  const spread = SPREAD_TYPES.find((s) => s.id === spreadId);
  const [question, setQuestion] = useState("");

  if (!spread) {
    // Defensive fallback — shouldn't happen since spreadId always comes
    // from SPREAD_TYPES, but keeps the component total.
    return (
      <div className={styles.screen}>
        <ScreenHeader title="Расклад" onBack={onBack} />
        <p className={styles.error}>Расклад не найден</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title={spread.title} onBack={onBack} />
      <p className={styles.description}>{spread.description}</p>

      <label className={styles.questionLabel} htmlFor="spread-question">
        Что вас волнует? (необязательно)
      </label>
      <textarea
        id="spread-question"
        className={styles.questionInput}
        placeholder="Например: стоит ли сейчас менять работу"
        value={question}
        maxLength={500}
        rows={2}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <Deck
        totalCards={VISUAL_DECK_SIZE}
        requiredCount={spread.cardCount}
        onSelectionComplete={() => onCardsSelected(spread.id, question.trim())}
      />
    </div>
  );
}
