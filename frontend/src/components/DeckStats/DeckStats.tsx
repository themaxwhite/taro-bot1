import type { ProfileInsights } from "../../types/history";
import styles from "./DeckStats.module.css";

interface DeckStatsProps {
  insights: ProfileInsights;
}

/** «1 раз», «2 раза», «5 раз» — иначе счётчик читается как ошибка. */
function timesWord(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 14) return "раз";
  const ones = n % 10;
  if (ones === 1) return "раз";
  if (ones >= 2 && ones <= 4) return "раза";
  return "раз";
}

/**
 * Что за карты человеку выпадают.
 *
 * Три самые частые карты показываются картинками из той же статики, что
 * и в раскладах: сказать «чаще всего вам выпадает Королева Жезлов» словами
 * можно, но узнаётся она в лицо, а не по названию.
 */
export function DeckStats({ insights }: DeckStatsProps) {
  // До первого расклада показывать нечего — блок просто не появляется,
  // вместо того чтобы висеть с нулями и прочерками.
  if (insights.totalCards === 0) return null;

  return (
    <section className={styles.card}>
      <h2 className={styles.heading}>Ваши карты</h2>

      <div className={styles.top}>
        {insights.topCards.map((card, i) => (
          <div key={card.cardId} className={styles.topCard}>
            <img
              className={styles.thumb}
              src={`/cards/${card.cardId}.webp`}
              alt={card.name}
              loading="lazy"
            />
            <span className={styles.topName}>{card.name}</span>
            <span className={styles.topCount}>
              {card.count} {timesWord(card.count)}
              {i === 0 && insights.topCards.length > 1 ? " · чаще всех" : ""}
            </span>
          </div>
        ))}
      </div>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Карт вытянуто</dt>
          <dd className={styles.factValue}>{insights.totalCards}</dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Перевёрнутых</dt>
          <dd className={styles.factValue}>{insights.reversedShare}%</dd>
        </div>
        <div className={styles.fact}>
          <dt className={styles.factLabel}>Старших арканов</dt>
          <dd className={styles.factValue}>{insights.majorShare}%</dd>
        </div>
      </dl>

      {insights.favoriteSpread && (
        <p className={styles.favorite}>
          Чаще всего раскладываете «{insights.favoriteSpread}» — {insights.favoriteSpreadCount}{" "}
          {timesWord(insights.favoriteSpreadCount)}
        </p>
      )}
    </section>
  );
}
