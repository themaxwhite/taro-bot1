import { useEffect, useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import type { DrawSpreadResponse } from "../../types/result";
import { drawSpread, SpreadsApiError } from "../../services/spreadsApi";
import { fetchInterpretation, drawExtraCard } from "../../services/aiApi";
import { getSubscriptionStatus } from "../../services/subscriptionsApi";
import type { SubscriptionStatus } from "../../types/subscription";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { CardFront } from "../../components/CardFront/CardFront";
import { LockedCards } from "../../components/LockedCards/LockedCards";
import { DailyCardCooldown } from "../../components/DailyCardCooldown/DailyCardCooldown";
import { ThinkingOverlay } from "../../components/ThinkingOverlay/ThinkingOverlay";
import { Spinner } from "../../components/Spinner/Spinner";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { FollowUpQuestions } from "../../components/FollowUpQuestions/FollowUpQuestions";
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
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const spread = SPREAD_TYPES.find((s) => s.id === spreadId);

  function refreshSubscription() {
    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {
        // Non-critical — the "⚡ бесплатно сегодня" hint and the custom-
        // question box just don't render without it.
      });
  }

  useEffect(refreshSubscription, []);

  const isPremium = subscription?.tier === "premium" || subscription?.tier === "admin";

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
      const { interpretation: text, cards } = await fetchInterpretation(recordId);
      setInterpretation(text);
      // Одна разблокировка открывает расклад целиком: карты приезжают
      // вместе с толкованием, до этого их в ответе не было вовсе.
      setState((prev) =>
        prev.status === "success" ? { status: "success", data: { ...prev.data, cards, unlocked: true } } : prev,
      );
      setInterpretState({ status: "idle" });
      refreshSubscription();
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
      refreshSubscription();
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
          {state.data.unlocked ? (
            <div className={styles.cardsRow}>
              {state.data.cards.map((card) => (
                <CardFront key={card.position} card={card} />
              ))}
            </div>
          ) : (
            <>
              <LockedCards count={state.data.card_count} />
              <p className={styles.lockedHint}>
                Карты уже выбраны. Откройте расклад, чтобы увидеть их и прочитать толкование.
              </p>
            </>
          )}

          {state.data.unlocked && spreadId === "yes-no" && state.data.cards.length > 0 && (
            <p className={styles.yesNoAnswer}>{state.data.cards[0].is_reversed ? "Скорее нет" : "Скорее да"}</p>
          )}

          {state.data.unlocked && (
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
          )}

          {state.data.next_available_at && <DailyCardCooldown nextAvailableAt={state.data.next_available_at} />}

          <div className={styles.paywallSection}>
            {interpretation ? (
              <>
                <div className={styles.interpretation}>{interpretation}</div>
                <FollowUpQuestions
                  spreadRecordId={state.data.id}
                  isPremium={isPremium}
                  onNeedSubscription={onNeedSubscription}
                  onQuotaSpent={refreshSubscription}
                />
              </>
            ) : (
              <button
                type="button"
                className={styles.unlockButton}
                disabled={interpretState.status === "working"}
                onClick={() => handleUnlockInterpretation(state.data.id)}
              >
                {state.data.unlocked ? "🔮 Подробное толкование" : "🔮 Открыть расклад"} · ✦ 1
              </button>
            )}
            {interpretState.status === "error" && (
              <>
                <p className={styles.paywallError}>{interpretState.message}</p>
                {interpretState.needsSubscription && (
                  <button type="button" className={styles.unlockButtonSecondary} onClick={onNeedSubscription}>
                    Пополнить энергию
                  </button>
                )}
              </>
            )}

            {/* Карта дня — ровно одна карта в сутки, в этом её смысл, так
                что тянуть к ней ещё одну нельзя (backend отвечает 400).
                На закрытом раскладе кнопки тоже нет: иначе расклад можно
                было бы открывать по частям в обход разблокировки. */}
            {spreadId !== "daily-card" && state.data.unlocked && (
              <button
                type="button"
                className={styles.unlockButtonSecondary}
                disabled={extraCardState.status === "working"}
                onClick={() => handleDrawExtraCard(state.data.id)}
              >
                {extraCardState.status === "working" ? "Тянем карту…" : "🃏 Вытянуть ещё карту · ✦ 1"}
              </button>
            )}
            {extraCardState.status === "error" && (
              <>
                <p className={styles.paywallError}>{extraCardState.message}</p>
                {extraCardState.needsSubscription && (
                  <button type="button" className={styles.unlockButtonSecondary} onClick={onNeedSubscription}>
                    Пополнить энергию
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
