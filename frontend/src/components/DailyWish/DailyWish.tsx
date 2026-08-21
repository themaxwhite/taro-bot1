import { useEffect, useState } from "react";
import { fetchDailyMessage } from "../../services/aiApi";
import styles from "./DailyWish.module.css";

export function DailyWish() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDailyMessage()
      .then((message) => {
        if (!cancelled) setText(message);
      })
      .catch(() => {
        // Non-critical banner — just stays hidden if the request fails,
        // no need to show an error state on the main screen for this.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!text) return null;

  return (
    <div className={styles.wish}>
      <span className={styles.icon} aria-hidden="true">
        ✦
      </span>
      <p className={styles.text}>{text}</p>
    </div>
  );
}
