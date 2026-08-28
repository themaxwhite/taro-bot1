import { useEffect, useState } from "react";
import { getDailyStory, type DailyStory as Story } from "../../services/storyApi";
import styles from "./DailyStory.module.css";

/**
 * История дня внизу главного экрана — меняется раз в сутки.
 *
 * Пометка «вымышленная история» стоит здесь не для галочки: тексты
 * сочиняет модель, и подать их как настоящие отзывы означало бы обмануть
 * пользователя. Убирать её нельзя, даже если так «продаёт лучше».
 *
 * Ошибку загрузки просто не показываем: это украшение внизу страницы, и
 * сообщение о сбое здесь навредит больше, чем отсутствие блока.
 */
export function DailyStory() {
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDailyStory()
      .then((s) => {
        if (!cancelled) setStory(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!story) return null;

  return (
    <section className={styles.card} aria-labelledby="daily-story-heading">
      <div className={styles.head}>
        <h2 id="daily-story-heading" className={styles.heading}>
          История дня
        </h2>
        <span className={styles.disclaimer}>вымышленная</span>
      </div>
      <p className={styles.text}>{story.text}</p>
      <p className={styles.byline}>
        {story.author} · расклад «{story.spreadTitle}»
      </p>
    </section>
  );
}
