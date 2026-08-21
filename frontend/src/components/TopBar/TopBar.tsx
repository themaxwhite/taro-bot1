import { SoundToggle } from "../SoundToggle/SoundToggle";
import styles from "./TopBar.module.css";

interface TopBarProps {
  onHistoryClick: () => void;
  onProfileClick: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function TopBar({ onHistoryClick, onProfileClick, soundEnabled, onToggleSound }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.leftGroup}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onHistoryClick}
          aria-label="История раскладов"
        >
          🕘
        </button>
        <SoundToggle enabled={soundEnabled} onToggle={onToggleSound} />
      </div>
      <span className={styles.title}>Tarot</span>
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
