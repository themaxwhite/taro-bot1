import { useEffect, useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import type { DrawSpreadResponse } from "../../types/result";
import { drawSpread, SpreadsApiError } from "../../services/spreadsApi";
import { fetchInterpretation, drawExtraCard, payWithStars } from "../../services/aiApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { CardFront } from "../../components/CardFront/CardFront";
import { Spinner } from "../../components/Spinner/Spinner";
import styles from "./ResultScreen.module.css";

interface ResultScreenProps {
  spreadId: SpreadId;
  question: string;
  onBack: () => void;
  onDone: () => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: DrawSpreadResponse };

type PaywallState =
  | { status: "idle" }
  | { status: "paying" }
  | { status: "error"; message: string };

export function ResultScreen({ spreadId, question, onBack, onDone }: ResultScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [interpretState, setInterpretState] = useState<PaywallState>({ status: "idle" });
  const [extraCardState, setExtraCardState] = useState<PaywallState>({ status: "idle" });
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
    setInterpretState({ status: "paying" });
    try {
      await payWithStars("interpretation", recordId);
      const text = await fetchInterpretation(recordId);
      setInterpretation(text);
      setInterpretState({ status: "idle" });
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить толкование.";
      setInterpretState({ status: "error", message });
    }
  }

  async function handleDrawExtraCard(recordId: number) {
    setExtraCardState({ status: "paying" });
    try {
      await payWithStars("extra_card", recordId);
      const data = await drawExtraCard(recordId);
      setState({ status: "success", data });
      setInterpretation(null); // the old interpretation no longer covers the full spread
      setExtraCardState({ status: "idle" });
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось вытянуть карту.";
      setExtraCardState({ status: "error", message });
    }
  }

  return (
    <div className={styles.screen}>
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

          <div className={styles.paywallSection}>
            {interpretation ? (
              <div className={styles.interpretation}>{interpretation}</div>
            ) : (
              <button
                type="button"
                className={styles.unlockButton}
                disabled={interpretState.status === "paying"}
                onClick={() => handleUnlockInterpretation(state.data.id)}
              >
                {interpretState.status === "paying" ? "Оплата…" : "🔮 Подробное толкование — ⭐"}
              </button>
            )}
            {interpretState.status === "error" && (
              <p className={styles.paywallError}>{interpretState.message}</p>
            )}

            <button
              type="button"
              className={styles.unlockButtonSecondary}
              disabled={extraCardState.status === "paying"}
              onClick={() => handleDrawExtraCard(state.data.id)}
            >
              {extraCardState.status === "paying" ? "Оплата…" : "🃏 Вытянуть ещё карту — ⭐"}
            </button>
            {extraCardState.status === "error" && (
              <p className={styles.paywallError}>{extraCardState.message}</p>
            )}
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.doneButton} onClick={onDone}>
              На главный
            </button>
          </div>
        </>
      )}
    </div>
  );
}
