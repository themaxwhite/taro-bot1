import type { Achievement } from "../../types/history";
import styles from "./Achievements.module.css";

interface AchievementsProps {
  achievements: Achievement[];
}

/**
 * Вехи, посчитанные сервером на лету (app/insights.py).
 *
 * Закрытые показываются приглушёнными, а не прячутся: смысл списка в
 * том, чтобы было видно, что ещё можно получить. Спрятанные достижения
 * не мотивируют — они просто не существуют для того, кто их не открыл.
 */
export function Achievements({ achievements }: AchievementsProps) {
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.heading}>Достижения</h2>
        <span className={styles.counter}>
          {unlocked} из {achievements.length}
        </span>
      </div>

      <ul className={styles.list}>
        {achievements.map((item) => (
          <li key={item.id} className={`${styles.item} ${item.unlocked ? "" : styles.locked}`}>
            <span className={styles.glyph} aria-hidden="true">
              {item.glyph}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.description}>{item.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
