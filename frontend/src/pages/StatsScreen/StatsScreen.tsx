import { useEffect, useState } from "react";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { Spinner } from "../../components/Spinner/Spinner";
import { ActivityCalendar } from "../../components/ActivityCalendar/ActivityCalendar";
import { DeckStats } from "../../components/DeckStats/DeckStats";
import { Achievements } from "../../components/Achievements/Achievements";
import { fetchProfileInsights } from "../../services/historyApi";
import type { ProfileInsights } from "../../types/history";
import styles from "./StatsScreen.module.css";

interface StatsScreenProps {
  onBack: () => void;
}

/**
 * Карта активности, статистика колоды и достижения.
 *
 * Раньше все три жили прямо в профиле, и он превращался в ленту из
 * десяти блоков, где настройки терялись под статистикой. Это интересно
 * посмотреть, но не каждый раз, когда заходишь переключить звук, —
 * поэтому теперь сюда ведёт одна строка.
 */
export function StatsScreen({ onBack }: StatsScreenProps) {
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfileInsights()
      .then((data) => {
        if (!cancelled) setInsights(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title="Статистика" onBack={onBack} />

      {!insights && !failed && (
        <div className={styles.centerState}>
          <Spinner />
        </div>
      )}

      {failed && <p className={styles.error}>Не удалось загрузить статистику.</p>}

      {insights && (
        <div className={styles.content}>
          <ActivityCalendar
            activity={insights.activity}
            from={insights.activityFrom}
            to={insights.activityTo}
          />
          <DeckStats insights={insights} />
          <Achievements achievements={insights.achievements} />
        </div>
      )}
    </div>
  );
}
