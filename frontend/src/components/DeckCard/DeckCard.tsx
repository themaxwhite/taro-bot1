import styles from "./DeckCard.module.css";

interface DeckCardProps {
  isSelected: boolean;
  selectionOrder: number | null;
  disabled: boolean;
  onClick: () => void;
}

export function DeckCard({
  isSelected,
  selectionOrder,
  disabled,
  onClick,
}: DeckCardProps) {
  const classNames = [
    styles.card,
    isSelected ? styles.selected : "",
    disabled && !isSelected ? styles.disabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classNames}
      onClick={onClick}
      disabled={disabled && !isSelected}
      aria-pressed={isSelected}
      aria-label={isSelected ? `Карта выбрана, позиция ${selectionOrder}` : "Выбрать карту"}
    >
      <span className={styles.pattern} aria-hidden="true" />
      {isSelected && selectionOrder !== null && (
        <span className={styles.badge}>{selectionOrder}</span>
      )}
    </button>
  );
}
