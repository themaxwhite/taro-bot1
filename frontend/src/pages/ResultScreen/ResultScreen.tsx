import { useEffect, useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import type { DrawSpreadResponse } from "../../types/result";
import { drawSpread, SpreadsApiError } from "../../services/spreadsApi";
import { fetchInterpretation, drawExtraCard } from "../../services/aiApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { CardFront } from "../../components/CardFront/CardFront";
import { DailyCardCooldown } from "../../components/DailyCardCooldown/DailyCardCooldown";
import { ThinkingOverlay } from "../../components/ThinkingOverlay/ThinkingOverlay";
import { Spinner } from "../../components/Spinner/Spinner";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  spreadId: SpreadId;
  question: string;
  onBack: () => void;
  onDone: () => void;
  onNeedSubscription: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: DrawSpreadResponse };

type ActionState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "error"; message: string; needsSubscription: boolean };

export function ResultScreen({ spreadId, question, onBack, onDone, onNeedSubscription }: ResultScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpretState, setInterpretState] = useState<ActionState>({ status: "idle" });
  const [extraCardState, setExtraCardState] = useState<ActionState>({ status: "idle" });
  const spread = SPREAD_TYPES.find((s) => s.id === spreadId);

  function load() {
    setState({ status: "loading" });
    drawSpread(spreadId, question)
      .then((data) => setState({ status: "success", data }))
      .catch((error: unknown) => {
        const message =
          error instanceof SpreadsApiError ? error.message : "Что-то пошло не так. Попробуйте ещё раз.";
        setState({ status: "error", message });
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadId]);

  async function handleUnlockInterpretation(recordId: number) {
    setInterpretState({ status: "working" });
    try {
      const text = await fetchInterpretation(recordId);
      setInterpretation(text);
      setInterpretState({ status: "idle" });
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить толкование.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setInterpretState({ status: "error", message, needsSubscription });
    }
  }

  async function handleDrawExtraCard(recordId: number) {
    setExtraCardState({ status: "working" });
    try {
      const data = await drawExtraCard(recordId);
      setState({ status: "success", data });
      setInterpretation(null); // the old interpretation no longer covers the full spread
      setExtraCardState({ status: "idle" });
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось вытянуть карту.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setExtraCardState({ status: "error", message, needsSubscription });
    }
  }

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title={spread?.title ?? "Расклад"} onBack={onBack} />

      {state.status === "loading" && (
        <div className={styles.centerState}>
          <Spinner />
          <p className={styles.centerText}>Карты открываются…</p>
        </div>
      )}

      {state.status === "error" && (
        <div className={styles.centerState}>
          <p className={styles.centerText}>{state.message}</p>
          <button type="button" className={styles.retryButton} onClick={load}>
            Повторить
          </button>
        </div>
      )}

      {state.status === "success" && (
        <>
          <div className={styles.cardsRow}>
            {state.data.cards.map((card) => (
              <CardFront key={card.position} card={card} />
            ))}
          </div>

          {spreadId === "yes-no" && (
            <p className={styles.yesNoAnswer}>{state.data.cards[0].is_reversed ? "Скорее нет" : "Скорее да"}</p>
          )}

          <div className={styles.meaningsList}>
            {state.data.cards.map((card) => (
              <div key={card.position} className={styles.meaningItem}>
                <p className={styles.meaningTitle}>
                  {card.position_label}: {card.name}
                  {card.is_reversed ? " (перевёрнутая)" : ""}
                </p>
                <p className={styles.meaningText}>{card.meaning}</p>
              </div>
            ))}
          </div>

          {state.data.next_available_at && <DailyCardCooldown nextAvailableAt={state.data.next_available_at} />}

          <div className={styles.paywallSection}>
            {interpretation ? (
              <div className={styles.interpretation}>{interpretation}</div>
            ) : (
              <button
                type="button"
                className={styles.unlockButton}
                disabled={interpretState.status === "working"}
                onClick={() => handleUnlockInterpretation(state.data.id)}
              >
                🔮 Подробное толкование
              </button>
            )}
            {interpretState.status === "error" && (
              <>
                <p className={styles.paywallError}>{interpretState.message}</p>
                {interpretState.needsSubscription && (
                  <button type="button" className={styles.unlockButtonSecondary} onClick={onNeedSubscription}>
                    Оформить подписку
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className={styles.unlockButtonSecondary}
              disabled={extraCardState.status === "working"}
              onClick={() => handleDrawExtraCard(state.data.id)}
            >
              {extraCardState.status === "working" ? "Тянем карту…" : "🃏 Вытянуть ещё карту"}
            </button>
            {extraCardState.status === "error" && (
              <>
                <p className={styles.paywallError}>{extraCardState.message}</p>
                {extraCardState.needsSubscription && (
                  <button type="button" className={styles.unlockButtonSecondary} onClick={onNeedSubscription}>
                    Оформить подписку
                  </button>
                )}
              </>
            )}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.doneButton} onClick={onDone}>
              На главный
            </button>
          </div>
        </>
      )}

      {interpretState.status === "working" && <ThinkingOverlay />}
    </div>
  );
}
