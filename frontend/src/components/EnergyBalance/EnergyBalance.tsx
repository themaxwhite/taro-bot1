import type { EnergyBreakdown } from "../../types/energy";
import styles from "./EnergyBalance.module.css";

interface EnergyBalanceProps {
  balance: number | null;
  onClick?: () => void;
  /** Развёрнутый вид со шкалой и подписью — для профиля; компактный — для главной. */
  variant?: "compact" | "detailed";
  breakdown?: EnergyBreakdown;
}

interface Gauge {
  charge: number;
  capacity: number;
  label: string;
}

/**
 * Что именно показывает шкала.
 *
 * Ёмкость есть только у двух источников: у месячной квоты подписки и у
 * суточной бесплатной зарядки. Купленная и реферальная энергия копится
 * без потолка — для неё знаменателя не существует, поэтому она идёт
 * отдельным «+N» сверх шкалы, а не подмешивается в неё. Иначе шкала
 * показывала бы 90/70, что не значит ничего.
 */
function gaugeFor(breakdown: EnergyBreakdown): Gauge {
  if (breakdown.subscription) {
    return {
      charge: breakdown.subscription.remaining,
      capacity: breakdown.subscription.total,
      label: "Квота подписки",
    };
  }
  return { charge: breakdown.daily, capacity: breakdown.dailyMax, label: "Заряд на сегодня" };
}

/**
 * Баланс разблокировок в виде аккумулятора.
 *
 * Число баланса намеренно объединяет все источники (суточная, подписка,
 * рефералы, купленная): пользователю важно «сколько я могу открыть», а
 * не из какого кармана спишется. Шкала же показывает ту часть, у которой
 * есть ёмкость, — иначе «заряд» не с чем соотносить.
 */
export function EnergyBalance({ balance, onClick, variant = "compact", breakdown }: EnergyBalanceProps) {
  // null = ещё грузится. Плашка рисуется сразу, чтобы страница не
  // прыгала, когда число приедет.
  const loading = balance === null;
  const gauge = breakdown ? gaugeFor(breakdown) : null;
  // Пол в 6% — чтобы 1 из 70 была видна полоской, а не исчезала совсем.
  // При нуле ширина именно 0: остаток 0/70 не должен выглядеть как «ещё
  // чуть-чуть осталось».
  const rawPercent = gauge && gauge.capacity > 0 ? Math.min((gauge.charge / gauge.capacity) * 100, 100) : 0;
  const percent = gauge && gauge.charge > 0 ? Math.max(rawPercent, 6) : 0;
  // Сверх ёмкости: купленная и реферальная. Считается от общего баланса,
  // а не суммированием источников, — так «+N» всегда сходится с числом.
  const extra = gauge && breakdown ? Math.max(breakdown.balance - gauge.charge, 0) : 0;
  const empty = !loading && (balance ?? 0) === 0;

  const Tag = onClick ? "button" : "div";

  const battery = (
    <span className={`${styles.battery} ${empty ? styles.batteryEmpty : ""}`} aria-hidden="true">
      <span className={styles.track}>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </span>
      <span className={styles.nub} />
    </span>
  );

  if (variant === "compact") {
    return (
      <Tag
        type={onClick ? "button" : undefined}
        className={styles.badge}
        onClick={onClick}
        aria-label={loading ? "Баланс энергии загружается" : `Энергия: ${balance}`}
      >
        {battery}
        <span className={styles.value}>{loading ? "…" : balance}</span>
      </Tag>
    );
  }

  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`${styles.badge} ${styles.detailed}`}
      onClick={onClick}
      aria-label={loading ? "Баланс энергии загружается" : `Энергия: ${balance}`}
    >
      <span className={styles.readoutRow}>
        {battery}
        <span className={styles.readout}>
          {gauge ? (
            <>
              <span className={styles.charge}>{gauge.charge}</span>
              <span className={styles.capacity}>/ {gauge.capacity}</span>
            </>
          ) : (
            <span className={styles.charge}>{loading ? "…" : balance}</span>
          )}
        </span>
      </span>

      <span className={styles.caption}>
        {gauge
          ? [gauge.label, extra > 0 ? `+ ✦ ${extra} сверх квоты` : null].filter(Boolean).join(" · ")
          : "энергия"}
      </span>

      {breakdown && (
        <span className={styles.hint}>
          {[
            breakdown.purchased > 0 ? `${breakdown.purchased} куплено` : null,
            breakdown.referral > 0 ? `${breakdown.referral} за друзей` : null,
            breakdown.subscription && breakdown.daily > 0 ? `${breakdown.daily} бесплатно сегодня` : null,
          ]
            .filter(Boolean)
            .join(" · ") || (empty ? "энергия закончилась" : "")}
        </span>
      )}
    </Tag>
  );
}
