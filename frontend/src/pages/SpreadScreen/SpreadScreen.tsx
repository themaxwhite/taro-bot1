import { useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Deck } from "../../components/Deck/Deck";
import { checkQuestion } from "../../services/spreadsApi";
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
  // Текст отказа от бэкенда, если вопрос попал под ограничения
  // (backend/app/moderation.py). Проверка серверная — здесь только
  // показываем причину рядом с полем, где её и ждут.
  const [questionError, setQuestionError] = useState<string | null>(null);

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

      {/* Ни подписи, ни примера: подсказка навязывала формулировку, и
          люди переписывали пример вместо собственного вопроса. Экранная
          подпись всё же нужна для доступности — но невидимая, чтобы
          скринридер объявил поле, а глазу ничего не диктовалось. */}
      <label className={styles.visuallyHidden} htmlFor="spread-question">
        Ваш вопрос к раскладу
      </label>
      <textarea
        id="spread-question"
        className={styles.questionInput}
        value={question}
        maxLength={500}
        rows={2}
        onChange={(e) => {
          setQuestion(e.target.value);
          if (questionError) setQuestionError(null);
        }}
        // Проверяем, как только человек ушёл из поля: так причина отказа
        // видна сразу, а не после того, как он вытянул карты.
        onBlur={async (e) => {
          const trimmed = e.target.value.trim();
          if (trimmed) setQuestionError(await checkQuestion(trimmed));
        }}
      />
      {questionError && <p className={styles.questionError}>{questionError}</p>}

      <Deck
        totalCards={VISUAL_DECK_SIZE}
        requiredCount={spread.cardCount}
        onSelectionComplete={async () => {
          const trimmed = question.trim();
          // Проверяем прежде, чем уйти на экран результата: там вопрос
          // уже не исправить, а розыгрыш всё равно бы его отклонил.
          const reason = trimmed ? await checkQuestion(trimmed) : null;
          if (reason) {
            setQuestionError(reason);
            return;
          }
          onCardsSelected(spread.id, trimmed);
        }}
      />
    </div>
  );
}
