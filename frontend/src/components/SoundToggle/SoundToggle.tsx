import styles from "./SoundToggle.module.css";

interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onToggle}
      aria-label={enabled ? "Выключить фоновый звук" : "Включить фоновый звук"}
      aria-pressed={enabled}
    >
      {enabled ? "🔊" : "🔈"}
    </button>
  );
}
