import styles from "./TopBar.module.css";

interface TopBarProps {
  onHistoryClick: () => void;
  onProfileClick: () => void;
}

export function TopBar({ onHistoryClick, onProfileClick }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onHistoryClick}
        aria-label="История раскладов"
      >
        🕘
      </button>
      <span className={styles.title}>TARO AURUM</span>
      <button
        type="button"
        className={styles.iconButton}
        onClick={onProfileClick}
        aria-label="Профиль"
      >
        👤
      </button>
    </header>
  );
}
