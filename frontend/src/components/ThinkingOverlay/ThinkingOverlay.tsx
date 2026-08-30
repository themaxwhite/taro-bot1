import { Spinner } from "../Spinner/Spinner";
import styles from "./ThinkingOverlay.module.css";

// Shown while the paid AI interpretation is generating — overlays the
// already-drawn cards (still visible underneath) rather than replacing
// the screen, so the wait doesn't feel like a blank loading state.
export function ThinkingOverlay() {
  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      <span className={styles.glyph} aria-hidden="true">
        🔮
      </span>
      <Spinner />
      <p className={styles.text}>Taro Aurum думает…</p>
    </div>
  );
}
