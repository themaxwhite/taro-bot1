import { useState } from "react";
import { fetchFollowUpAnswer } from "../../services/aiApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import type { HistoryFollowUp } from "../../types/history";
import styles from "./FollowUpQuestions.module.css";

interface FollowUpQuestionsProps {
  spreadRecordId: number;
  /** Already-answered follow-ups, e.g. when reopening a spread from History. */
  initialAnswers?: HistoryFollowUp[];
  onNeedSubscription: () => void;
}

// IMPORTANT: keep these keys/labels in sync with
// backend/app/api/ai.py::FOLLOW_UP_QUESTIONS.
const QUESTIONS: { key: string; label: string }[] = [
  { key: "risks", label: "Какие риски?" },
  { key: "future", label: "Что в будущем?" },
  { key: "potential", label: "Есть ли перспектива?" },
  { key: "advice", label: "Что делать?" },
];

type QuestionState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string; needsSubscription: boolean };

export function FollowUpQuestions({ spreadRecordId, initialAnswers, onNeedSubscription }: FollowUpQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries((initialAnswers ?? []).map((fu) => [fu.questionKey, fu.answer])),
  );
  const [states, setStates] = useState<Record<string, QuestionState>>({});

  async function handleAsk(key: string) {
    setStates((prev) => ({ ...prev, [key]: { status: "loading" } }));
    try {
      const result = await fetchFollowUpAnswer(spreadRecordId, key);
      setAnswers((prev) => ({ ...prev, [key]: result.answer }));
      setStates((prev) => ({ ...prev, [key]: { status: "idle" } }));
    } catch (error) {
      const message = error instanceof SpreadsApiError ? error.message : "Не удалось получить ответ.";
      const needsSubscription = error instanceof SpreadsApiError && error.status === 402;
      setStates((prev) => ({ ...prev, [key]: { status: "error", message, needsSubscription } }));
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>Уточнить по раскладу</p>
      <div className={styles.chips}>
        {QUESTIONS.map((q) => {
          const answered = answers[q.key];
          const state = states[q.key] ?? { status: "idle" };
          if (answered) return null;
          return (
            <button
              key={q.key}
              type="button"
              className={styles.chip}
              disabled={state.status === "loading"}
              onClick={() => handleAsk(q.key)}
            >
              {state.status === "loading" ? "Спрашиваем…" : q.label}
            </button>
          );
        })}
      </div>

      {QUESTIONS.map((q) => {
        const answered = answers[q.key];
        const state = states[q.key] ?? { status: "idle" };
        return (
          <div key={q.key}>
            {answered && (
              <div className={styles.answerCard}>
                <p className={styles.answerTitle}>{q.label}</p>
                <p className={styles.answerText}>{answered}</p>
              </div>
            )}
            {state.status === "error" && (
              <div className={styles.errorRow}>
                <p className={styles.errorText}>{state.message}</p>
                {state.needsSubscription && (
                  <button type="button" className={styles.subscribeButton} onClick={onNeedSubscription}>
                    Оформить подписку
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
