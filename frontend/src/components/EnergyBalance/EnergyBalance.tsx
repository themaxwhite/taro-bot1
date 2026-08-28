import styles from "./EnergyBalance.module.css";

interface EnergyBalanceProps {
  balance: number | null;
  onClick?: () => void;
  /** Развёрнутый вид с подписью — для профиля; компактный — для главной. */
  variant?: "compact" | "detailed";
  breakdown?: { daily: number; purchased: number; referral: number };
}

/**
 * Баланс разблокировок. Одно число намеренно объединяет все источники
 * (суточная, подписка, рефералы, купленная): пользователю важно «сколько
 * я могу открыть», а не из какого кармана это спишется. Разбивка
 * показывается только в профиле, где есть место объяснить.
 */
export function EnergyBalance({ balance, onClick, variant = "compact", breakdown }: EnergyBalanceProps) {
  // null = ещё грузится. Показываем плашку сразу, чтобы страница не
  // прыгала, когда число приедет.
  const label = balance === null ? "…" : String(balance);
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`${styles.badge} ${variant === "detailed" ? styles.detailed : ""}`}
      onClick={onClick}
      aria-label={balance === null ? "Баланс энергии загружается" : `Энергия: ${balance}`}
    >
      <span className={styles.icon} aria-hidden="true">
        ✦
      </span>
      <span className={styles.value}>{label}</span>
      {variant === "detailed" && (
        <span className={styles.hint}>
          {breakdown
            ? [
                breakdown.daily > 0 ? `${breakdown.daily} сегодня` : null,
                breakdown.purchased > 0 ? `${breakdown.purchased} куплено` : null,
                breakdown.referral > 0 ? `${breakdown.referral} за друзей` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "энергия закончилась"
            : "энергия"}
        </span>
      )}
    </Tag>
  );
}
