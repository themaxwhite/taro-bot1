import { useState } from "react";
import type { HistoryEntry } from "../../types/history";
import { fetchInterpretation } from "../../services/aiApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { CardFront } from "../../components/CardFront/CardFront";
import { ThinkingOverlay } from "../../components/ThinkingOverlay/ThinkingOverlay";
import resultStyles from "../ResultScreen/ResultScreen.module.css";
import styles from "./HistoryDetailScreen.module.css";

interface HistoryDetailScreenProps {
  entry: HistoryEntry;
  onBack: () => void;
  onNeedSubscription: () => void;
}

type ActionState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error"; message: string; needsSubscription: boolean };

// Read-only view of a past reading from History — same layout as
// ResultScreen (reuses its styles) minus the draw step and the extra-
// card action, which only make sense right after a fresh draw.
export function HistoryDetailScreen({ entry, onBack, onNeedSubscription }: HistoryDetailScreenProps) {
  const [interpretation, setInterpretation] = useState<string | null>(entry.interpretation);
  const [interpretState, setInterpretState] = useState<ActionState>({ status: "idle" });

  async function handleUnlock() {
    setInterpretState({ status: "working" });
    try {
      const text = await fetchInterpretation(entry.id);
      setInterpretation(text);
      setInterpretState({ status: "idle" });
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить толкование.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setInterpretState({ status: "error", message, needsSubscription });
    }
  }

  return (
    <div className={resultStyles.screen}>
      <ScreenHeader title={entry.spreadTitle} onBack={onBack} />

      {entry.question && <p className={styles.question}>«{entry.question}»</p>}

      <div className={resultStyles.cardsRow}>
        {entry.cards.map((card) => (
          <CardFront key={card.position} card={card} />
        ))}
      </div>

      <div className={resultStyles.meaningsList}>
        {entry.cards.map((card) => (
          <div key={card.position} className={resultStyles.meaningItem}>
            <p className={resultStyles.meaningTitle}>
              {card.position_label}: {card.name}
              {card.is_reversed ? " (перевёрнутая)" : ""}
            </p>
            <p className={resultStyles.meaningText}>{card.meaning}</p>
          </div>
        ))}
      </div>

      <div className={resultStyles.paywallSection}>
        {interpretation ? (
          <div className={resultStyles.interpretation}>{interpretation}</div>
        ) : (
          <button
            type="button"
            className={resultStyles.unlockButton}
            disabled={interpretState.status === "working"}
            onClick={handleUnlock}
          >
            🔮 Подробное толкование
          </button>
        )}
        {interpretState.status === "error" && (
          <>
            <p className={resultStyles.paywallError}>{interpretState.message}</p>
            {interpretState.needsSubscription && (
              <button type="button" className={resultStyles.unlockButtonSecondary} onClick={onNeedSubscription}>
                Оформить подписку
              </button>
            )}
          </>
        )}
      </div>

      {interpretState.status === "working" && <ThinkingOverlay />}
    </div>
  );
}
