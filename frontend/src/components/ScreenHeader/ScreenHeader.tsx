import styles from "./ScreenHeader.module.css";

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.backButton}
        onClick={onBack}
        aria-label="Назад"
      >
        ←
      </button>
      <span className={styles.title}>{title}</span>
      <span className={styles.spacer} aria-hidden="true" />
    </header>
  );
}
