import { useEffect, useState } from "react";
import type { HistoryEntry } from "../../types/history";
import { fetchHistory } from "../../services/historyApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { HistoryListItem } from "../../components/HistoryListItem/HistoryListItem";
import { Spinner } from "../../components/Spinner/Spinner";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./HistoryScreen.module.css";

interface HistoryScreenProps {
  onBack: () => void;
  onOpenEntry: (entry: HistoryEntry) => void;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; entries: HistoryEntry[] };

export function HistoryScreen({ onBack, onOpenEntry }: HistoryScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetchHistory()
      .then((entries) => {
        if (!cancelled) setState({ status: "success", entries });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof SpreadsApiError
            ? error.message
            : "Не удалось загрузить историю. Попробуйте ещё раз.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title="История" onBack={onBack} />

      {state.status === "loading" && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {state.status === "error" && (
        <p className={styles.empty}>{state.message}</p>
      )}

      {state.status === "success" && state.entries.length === 0 && (
        <p className={styles.empty}>
          Здесь появятся ваши расклады, как только вы сделаете первый.
        </p>
      )}

      {state.status === "success" && state.entries.length > 0 && (
        <div className={styles.list}>
          {state.entries.map((entry) => (
            <HistoryListItem key={entry.id} entry={entry} onClick={() => onOpenEntry(entry)} />
          ))}
        </div>
      )}
    </div>
  );
}
