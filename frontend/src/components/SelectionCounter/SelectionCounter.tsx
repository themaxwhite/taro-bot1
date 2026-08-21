import styles from "./SelectionCounter.module.css";

interface SelectionCounterProps {
  selected: number;
  required: number;
}

export function SelectionCounter({ selected, required }: SelectionCounterProps) {
  return (
    <div className={styles.counter}>
      Выбрано{" "}
      <span className={styles.value}>
        {selected} из {required}
      </span>
    </div>
  );
}
