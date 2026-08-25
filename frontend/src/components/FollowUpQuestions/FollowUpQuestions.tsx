import { useState } from "react";
import { fetchFollowUpAnswer, fetchCustomFollowUpAnswer } from "../../services/aiApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import type { HistoryFollowUp } from "../../types/history";
import styles from "./FollowUpQuestions.module.css";

interface FollowUpQuestionsProps {
  spreadRecordId: number;
  /** Already-answered follow-ups, e.g. when reopening a spread from History. */
  initialAnswers?: HistoryFollowUp[];
  /** Премиум tier only — unlocks the free-text question box. */
  isPremium: boolean;
  onNeedSubscription: () => void;
  /** Called after any question is successfully billed, so the parent can refresh its energy/quota display. */
  onQuotaSpent: () => void;
}

// IMPORTANT: keep these keys/labels in sync with
// backend/app/api/ai.py::FOLLOW_UP_QUESTIONS.
const QUESTIONS: { key: string; label: string }[] = [
  { key: "risks", label: "Какие риски?" },
  { key: "future", label: "Что в будущем?" },
  { key: "potential", label: "Есть ли перспектива?" },
  { key: "advice", label: "Что делать?" },
];

interface AnsweredEntry {
  key: string;
  label: string;
  answer: string;
}

type ActionState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string; needsSubscription: boolean };

export function FollowUpQuestions({
  spreadRecordId,
  initialAnswers,
  isPremium,
  onNeedSubscription,
  onQuotaSpent,
}: FollowUpQuestionsProps) {
  const [answered, setAnswered] = useState<AnsweredEntry[]>(() =>
    (initialAnswers ?? []).map((fu) => ({ key: fu.questionKey, label: fu.questionLabel, answer: fu.answer })),
  );
  const [presetStates, setPresetStates] = useState<Record<string, ActionState>>({});
  const [customQuestion, setCustomQuestion] = useState("");
  const [customState, setCustomState] = useState<ActionState>({ status: "idle" });

  const answeredKeys = new Set(answered.map((a) => a.key));

  async function handleAskPreset(key: string, label: string) {
    setPresetStates((prev) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const result = await fetchFollowUpAnswer(spreadRecordId, key);
      setAnswered((prev) => [...prev, { key, label, answer: result.answer }]);
      setPresetStates((prev) => ({ ...prev, [key]: { status: "idle" } }));
      onQuotaSpent();
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить ответ.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setPresetStates((prev) => ({ ...prev, [key]: { status: "error", message, needsSubscription } }));
    }
  }

  async function handleAskCustom() {
    const question = customQuestion.trim();
    if (!question) return;
    setCustomState({ status: "loading" });
    try {
      const result = await fetchCustomFollowUpAnswer(spreadRecordId, question);
      setAnswered((prev) => [...prev, { key: result.questionKey, label: result.questionLabel, answer: result.answer }]);
      setCustomQuestion("");
      setCustomState({ status: "idle" });
      onQuotaSpent();
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить ответ.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setCustomState({ status: "error", message, needsSubscription });
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Уточнить по раскладу</p>
      <div className={styles.chips}>
        {QUESTIONS.filter((q) => !answeredKeys.has(q.key)).map((q) => {
          const state = presetStates[q.key] ?? { status: "idle" };
          return (
            <button
              key={q.key}
              type="button"
              className={styles.chip}
              disabled={state.status === "loading"}
              onClick={() => handleAskPreset(q.key, q.label)}
            >
              {state.status === "loading" ? "Спрашиваем…" : q.label}
            </button>
          );
        })}
      </div>

      {QUESTIONS.map((q) => {
        const state = presetStates[q.key];
        if (state?.status !== "error") return null;
        return (
          <div key={q.key} className={styles.errorRow}>
            <p className={styles.errorText}>{state.message}</p>
            {state.needsSubscription && (
              <button type="button" className={styles.subscribeButton} onClick={onNeedSubscription}>
                Оформить подписку
              </button>
            )}
          </div>
        );
      })}

      {answered.map((a) => (
        <div key={a.key} className={styles.answerCard}>
          <p className={styles.answerTitle}>{a.label}</p>
          <p className={styles.answerText}>{a.answer}</p>
        </div>
      ))}

      {isPremium && (
        <div className={styles.customBox}>
          <p className={styles.customLabel}>✨ Свой вопрос (Премиум)</p>
          <textarea
            className={styles.customInput}
            value={customQuestion}
            maxLength={300}
            rows={2}
            placeholder="Например: стоит ли сейчас менять работу"
            onChange={(e) => setCustomQuestion(e.target.value)}
          />
          <button
            type="button"
            className={styles.customButton}
            disabled={!customQuestion.trim() || customState.status === "loading"}
            onClick={handleAskCustom}
          >
            {customState.status === "loading" ? "Спрашиваем…" : "Спросить"}
          </button>
          {customState.status === "error" && (
            <div className={styles.errorRow}>
              <p className={styles.errorText}>{customState.message}</p>
              {customState.needsSubscription && (
                <button type="button" className={styles.subscribeButton} onClick={onNeedSubscription}>
                  Оформить подписку
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
