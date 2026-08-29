import { useEffect, useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import { fetchUntriedSpreads } from "../../services/historyApi";
import { hapticTap } from "../../feedback/haptics";
import styles from "./SpreadSuggestion.module.css";

interface SpreadSuggestionProps {
  onSelectSpread: (id: SpreadId) => void;
}

// «Карта дня» бесплатна и живёт отдельным баннером, поэтому в счёт
// «всех раскладов» не идёт — ровно как на сервере
// (app/spreads.py::CHOOSABLE_SPREADS). Два разных ответа на вопрос
// «все — это сколько?» читаются как ошибка.
const CHOOSABLE = SPREAD_TYPES.filter((spread) => spread.id !== "daily-card");

/**
 * Подсказка внизу главной: расклад, который человек ещё не пробовал.
 *
 * Одиннадцать плиток легко воспринимаются как «те три, что я знаю, и
 * ещё какие-то». Эта строчка называет одну конкретную непройденную и
 * ведёт прямо в неё — и попутно двигает к достижению «Все расклады».
 *
 * Порядок берётся из SPREAD_TYPES, то есть тот же, что и на сетке:
 * простые впереди, «Кельтский крест» в конце. Не случайный — подсказка,
 * меняющаяся при каждом заходе, читается как реклама, а не как совет.
 */
export function SpreadSuggestion({ onSelectSpread }: SpreadSuggestionProps) {
  const [untried, setUntried] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUntriedSpreads()
      .then((ids) => {
        if (!cancelled) setUntried(ids);
      })
      .catch(() => {
        // Подсказка необязательна: не загрузилась — блока просто нет.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (untried === null) return null;

  // Всё опробовано — вместо подсказки признание заслуги. Прятать блок
  // молча значило бы, что доведённое до конца дело ничем не отмечено.
  if (untried.length === 0) {
    return (
      <section className={styles.card}>
        <span className={styles.glyph} aria-hidden="true">
          🗺
        </span>
        <div className={styles.body}>
          <span className={styles.title}>Вы попробовали все расклады</span>
          <span className={styles.text}>
            Все {CHOOSABLE.length} видов пройдены — возвращайтесь к тем, что отзываются.
          </span>
        </div>
      </section>
    );
  }

  const next = CHOOSABLE.find((spread) => untried.includes(spread.id));
  if (!next) return null;

  return (
    <button
      type="button"
      className={`${styles.card} ${styles.clickable}`}
      onClick={() => {
        hapticTap();
        onSelectSpread(next.id);
      }}
    >
      <span className={styles.glyph} aria-hidden="true">
        ✨
      </span>
      <div className={styles.body}>
        <span className={styles.title}>Ещё не пробовали: «{next.title}»</span>
        <span className={styles.text}>{next.description}</span>
      </div>
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </button>
  );
}
