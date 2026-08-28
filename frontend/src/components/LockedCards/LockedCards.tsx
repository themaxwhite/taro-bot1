import styles from "./LockedCards.module.css";

interface LockedCardsProps {
  count: number;
}

/**
 * Рубашки вместо карт для неоплаченного расклада.
 *
 * Карты уже выбраны движком и лежат на сервере — сюда они просто не
 * приезжают (см. backend/app/tarot/visibility.py). Это важно: прятать
 * карты стилями было бы бессмысленно, их было бы видно в ответе сервера.
 * Здесь рисовать нечего по-настоящему — потому и рубашки.
 */
export function LockedCards({ count }: LockedCardsProps) {
  return (
    <div className={styles.row} role="img" aria-label={`${count} закрытых карт`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card}>
          <img className={styles.image} src="/cards/card-back.webp" alt="" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
