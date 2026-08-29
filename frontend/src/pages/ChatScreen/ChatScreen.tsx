import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { Spinner } from "../../components/Spinner/Spinner";
import { askTarologist, fetchChat, type ChatMessage } from "../../services/chatApi";
import { SpreadsApiError } from "../../services/spreadsApi";
import { hapticTap } from "../../feedback/haptics";
import styles from "./ChatScreen.module.css";

interface ChatScreenProps {
  onBack: () => void;
  onNeedEnergy: () => void;
}

type LoadState = "loading" | "ready" | "error";

export function ChatScreen({ onBack, onNeedEnergy }: ChatScreenProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cost, setCost] = useState(5);
  const [balance, setBalance] = useState(0);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEnergy, setNeedsEnergy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchChat()
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages);
        setCost(data.cost);
        setBalance(data.balance);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Прокрутка к последней реплике — и при открытии, и после каждого
  // ответа. Разговор, открывшийся на первом сообщении месячной
  // давности, выглядит сломанным.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 0 ? "smooth" : "auto" });
  }, [messages, asking]);

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    hapticTap();
    setAsking(true);
    setError(null);
    setNeedsEnergy(false);
    try {
      const result = await askTarologist(trimmed);
      setMessages((prev) => [...prev, result.question, result.answer]);
      setBalance(result.balance);
      setQuestion("");
    } catch (e) {
      const message = e instanceof SpreadsApiError ? e.message : "Не удалось отправить вопрос.";
      setError(message);
      // 402 — единственный случай, из которого есть выход прямо отсюда:
      // показываем путь к пополнению, а не только текст отказа.
      if (e instanceof SpreadsApiError && e.status === 402) setNeedsEnergy(true);
    } finally {
      setAsking(false);
    }
  }

  const canAsk = question.trim().length > 0 && !asking;

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title="Таролог" onBack={onBack} />

      <div className={styles.thread}>
        {state === "loading" && (
          <div className={styles.centerState}>
            <Spinner />
          </div>
        )}

        {state === "error" && <p className={styles.error}>Не удалось загрузить переписку.</p>}

        {state === "ready" && messages.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyGlyph} aria-hidden="true">
              🔮
            </span>
            <p className={styles.emptyTitle}>Спросите о чём угодно</p>
            <p className={styles.emptyText}>
              Таролог видит ваш последний расклад и помнит разговор. Спрашивайте своими
              словами — как у живого человека.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.bubble} ${
              message.role === "user" ? styles.fromUser : styles.fromTarologist
            }`}
          >
            {message.text}
          </div>
        ))}

        {asking && (
          <div className={`${styles.bubble} ${styles.fromTarologist} ${styles.thinking}`}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {needsEnergy && (
        <button type="button" className={styles.topUp} onClick={onNeedEnergy}>
          Пополнить энергию
        </button>
      )}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={question}
          maxLength={1000}
          rows={1}
          placeholder="Ваш вопрос тарологу"
          disabled={asking}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="button" className={styles.send} disabled={!canAsk} onClick={handleAsk}>
          {asking ? "…" : `✦ ${cost}`}
        </button>
      </div>
      <p className={styles.hint}>
        {asking
          ? "Таролог думает — иногда это занимает до минуты"
          : `Вопрос стоит ✦ ${cost}. У вас ✦ ${balance}`}
      </p>
    </div>
  );
}
