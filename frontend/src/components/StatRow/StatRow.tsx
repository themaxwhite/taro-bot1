import styles from "./StatRow.module.css";

interface Stat {
  label: string;
  value: string | number;
}

interface StatRowProps {
  stats: Stat[];
}

export function StatRow({ stats }: StatRowProps) {
  return (
    <div className={styles.row}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.stat}>
          <span className={styles.value}>{stat.value}</span>
          <span className={styles.label}>{stat.label}</span>
        </div>
      ))}
    </div>
  );
}
