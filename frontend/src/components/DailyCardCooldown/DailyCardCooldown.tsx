import { useEffect, useState } from "react";
import styles from "./DailyCardCooldown.module.css";

interface DailyCardCooldownProps {
  /** ISO 8601 timestamp — when the next daily card becomes available. */
  nextAvailableAt: string;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Live countdown to the next daily-card draw — the "карта дня" cooldown
// is a rolling 24h window from when the current card was drawn, not a
// calendar-day reset (see backend/app/api/spreads.py::DAILY_CARD_COOLDOWN).
export function DailyCardCooldown({ nextAvailableAt }: DailyCardCooldownProps) {
  const target = new Date(nextAvailableAt).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) {
    return <p className={styles.cooldown}>Новая карта дня уже доступна — вернитесь на главный экран.</p>;
  }

  return (
    <p className={styles.cooldown}>
      Новая карта дня будет доступна через <span className={styles.time}>{formatRemaining(remaining)}</span>
    </p>
  );
}
