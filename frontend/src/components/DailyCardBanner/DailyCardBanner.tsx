import styles from "./DailyCardBanner.module.css";

interface DailyCardBannerProps {
  onClick: () => void;
}

export function DailyCardBanner({ onClick }: DailyCardBannerProps) {
  return (
    <button type="button" className={styles.banner} onClick={onClick}>
      <div className={styles.text}>
        <span className={styles.eyebrow}>Сегодня</span>
        <span className={styles.heading}>Расклад дня</span>
        <span className={styles.hint}>Вытяните одну карту</span>
      </div>
      <span className={styles.cardGlyph} aria-hidden="true">
        🔮
      </span>
    </button>
  );
}
