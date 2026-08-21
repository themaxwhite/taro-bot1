import type { SpreadType } from "../../types/tarot";
import { SpreadCard } from "../SpreadCard/SpreadCard";
import styles from "./SpreadList.module.css";

interface SpreadListProps {
  spreads: SpreadType[];
  onSelect: (id: SpreadType["id"]) => void;
}

export function SpreadList({ spreads, onSelect }: SpreadListProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Расклады</h2>
      <div className={styles.list}>
        {spreads.map((spread) => (
          <SpreadCard key={spread.id} spread={spread} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
