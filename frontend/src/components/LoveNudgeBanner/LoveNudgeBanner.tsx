import { useEffect, useState } from "react";
import type { SpreadId } from "../../types/tarot";
import type { Gender } from "../../services/historyApi";
import styles from "./LoveNudgeBanner.module.css";

interface LoveNudgeBannerProps {
  gender: Gender | null;
  onSelectSpread: (id: SpreadId) => void;
}

const STORAGE_KEY = "tarot-aurum:love-nudge-last-shown";

interface Nudge {
  spreadId: SpreadId;
  // Pronoun-aware copy — "male" means the user is male, so the partner
  // being asked about is referred to as "она"; "female" is the reverse.
  male: string;
  female: string;
}

// Rotates by day-of-year (not randomly on every render) so the same
// message/spread pairing holds for the whole day. Spread deliberately
// alternates between the three relationship-themed spreads so this
// isn't just a "Да или нет" ad every time.
const NUDGES: Nudge[] = [
  { spreadId: "yes-no", male: "Самое время узнать: любит ли она тебя? 💕", female: "Самое время узнать: любит ли он тебя? 💕" },
  { spreadId: "love", male: "Она думает о тебе чаще, чем кажется…", female: "Он думает о тебе чаще, чем кажется…" },
  { spreadId: "compatibility", male: "Карты знают, что у неё на сердце", female: "Карты знают, что у него на сердце" },
  { spreadId: "yes-no", male: "Один вопрос, один ответ: чувствует ли она то же самое?", female: "Один вопрос, один ответ: чувствует ли он то же самое?" },
  { spreadId: "compatibility", male: "Узнайте вашу совместимость по картам", female: "Узнайте вашу совместимость по картам" },
];

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

// Local calendar day, matching dayOfYear's local-time basis — using
// toISOString() (UTC) here instead would let the "shown today" key and
// the nudge-of-the-day roll over at different moments for any viewer
// not in UTC (e.g. Moscow, UTC+3): the dismissed banner could reappear
// the same local day, or stay suppressed into the next one.
function todayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LoveNudgeBanner({ gender, onSelectSpread }: LoveNudgeBannerProps) {
  // Starts hidden so there's no flash-then-hide if it was already
  // dismissed today — the effect below is what actually reveals it.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!gender) return;
    let lastShown: string | null = null;
    try {
      lastShown = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode, etc.) — just show it,
      // it'll simply reappear next time too, which is harmless.
    }
    if (lastShown !== todayKey(new Date())) {
      setVisible(true);
    }
  }, [gender]);

  if (!gender || !visible) return null;

  const nudge = NUDGES[dayOfYear(new Date()) % NUDGES.length];
  const text = gender === "male" ? nudge.male : nudge.female;

  function markShownToday() {
    try {
      localStorage.setItem(STORAGE_KEY, todayKey(new Date()));
    } catch {
      // best-effort only — worst case it shows again next open today
    }
    setVisible(false);
  }

  return (
    <div className={styles.banner}>
      <button
        type="button"
        className={styles.content}
        onClick={() => {
          markShownToday();
          onSelectSpread(nudge.spreadId);
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          💌
        </span>
        <span className={styles.text}>{text}</span>
      </button>
      <button type="button" className={styles.dismiss} onClick={markShownToday} aria-label="Скрыть">
        ✕
      </button>
    </div>
  );
}
