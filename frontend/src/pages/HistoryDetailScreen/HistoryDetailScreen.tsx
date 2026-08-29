import { useEffect, useState } from "react";
import type { HistoryEntry } from "../../types/history";
import type { SubscriptionStatus } from "../../types/subscription";
import { fetchInterpretation } from "../../services/aiApi";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { CardFront } from "../../components/CardFront/CardFront";
import { LockedCards } from "../../components/LockedCards/LockedCards";
import { ThinkingOverlay } from "../../components/ThinkingOverlay/ThinkingOverlay";
import { FollowUpQuestions } from "../../components/FollowUpQuestions/FollowUpQuestions";
import resultStyles from "../ResultScreen/ResultScreen.module.css";
import { isSpeechSupported, primeVoices, speak, stopSpeech } from "../../feedback/speech";
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
  // Расклад мог остаться неоплаченным — тогда карт в записи нет, и они
  // появятся здесь только после разблокировки.
  const [cards, setCards] = useState(entry.cards);
  const [unlocked, setUnlocked] = useState(entry.unlocked);
  const [interpretState, setInterpretState] = useState<ActionState>({ status: "idle" });
  const [speaking, setSpeaking] = useState(false);

  // То же, что на экране результата: прогреть список голосов заранее и
  // оборвать чтение при уходе, иначе голос продолжит поверх следующего
  // экрана.
  useEffect(() => {
    primeVoices();
    return stopSpeech;
  }, []);

  function toggleSpeech(text: string) {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    if (speak(text, () => setSpeaking(false))) setSpeaking(true);
  }
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  function refreshSubscription() {
    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {});
  }

  useEffect(refreshSubscription, []);

  const isPremium = subscription?.tier === "premium" || subscription?.tier === "admin";

  async function handleUnlock() {
    setInterpretState({ status: "working" });
    try {
      const { interpretation: text, cards: revealed } = await fetchInterpretation(entry.id);
      setInterpretation(text);
      setCards(revealed);
      setUnlocked(true);
      setInterpretState({ status: "idle" });
      refreshSubscription();
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

      {unlocked ? (
        <div className={resultStyles.cardsRow}>
          {cards.map((card) => (
            <CardFront key={card.position} card={card} />
          ))}
        </div>
      ) : (
        <>
          <LockedCards count={entry.cardCount} />
          <p className={resultStyles.lockedHint}>Этот расклад так и остался закрытым.</p>
        </>
      )}

      {unlocked && (
        <div className={resultStyles.meaningsList}>
          {cards.map((card) => (
            <div key={card.position} className={resultStyles.meaningItem}>
              <p className={resultStyles.meaningTitle}>
                {card.position_label}: {card.name}
                {card.is_reversed ? " (перевёрнутая)" : ""}
              </p>
              <p className={resultStyles.meaningText}>{card.meaning}</p>
            </div>
          ))}
        </div>
      )}

      <div className={resultStyles.paywallSection}>
        {interpretation ? (
          <>
            <div className={resultStyles.interpretation}>{interpretation}</div>
            {isSpeechSupported() && (
              <button
                type="button"
                className={resultStyles.listenButton}
                onClick={() => toggleSpeech(interpretation)}
              >
                {speaking ? "◼ Остановить" : "▶ Послушать толкование"}
              </button>
            )}
            <FollowUpQuestions
              spreadRecordId={entry.id}
              initialAnswers={entry.followUps}
              isPremium={isPremium}
              onNeedSubscription={onNeedSubscription}
              onQuotaSpent={refreshSubscription}
            />
          </>
        ) : (
          <button
            type="button"
            className={resultStyles.unlockButton}
            disabled={interpretState.status === "working"}
            onClick={handleUnlock}
          >
            {unlocked ? "🔮 Подробное толкование" : "🔮 Открыть расклад"} · ✦ 1
          </button>
        )}
        {interpretState.status === "error" && (
          <>
            <p className={resultStyles.paywallError}>{interpretState.message}</p>
            {interpretState.needsSubscription && (
              <button type="button" className={resultStyles.unlockButtonSecondary} onClick={onNeedSubscription}>
                Пополнить энергию
              </button>
            )}
          </>
        )}
      </div>

      {interpretState.status === "working" && <ThinkingOverlay />}
    </div>
  );
}
