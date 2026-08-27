import { hasNativeBackButton } from "../../hooks/useTelegramBackButton";
import styles from "./ScreenHeader.module.css";

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

export function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  // Inside Telegram the back button lives in the client's own header and
  // is wired up once in App.tsx, so drawing another arrow here would
  // just be a second back button two centimetres below the first. In a
  // plain browser (local dev, or the app opened outside Telegram) there
  // is no such chrome, and this arrow is the only way back.
  const native = hasNativeBackButton();

  return (
    <header className={styles.header}>
      {native ? (
        // Keeps the title optically centred: the header is a three-part
        // row, so the slot has to stay occupied even when empty.
        <span className={styles.spacer} aria-hidden="true" />
      ) : (
        <button type="button" className={styles.backButton} onClick={onBack} aria-label="Назад">
          ←
        </button>
      )}
      <span className={styles.title}>{title}</span>
      <span className={styles.spacer} aria-hidden="true" />
    </header>
  );
}
