import { hapticTap } from "../../feedback/haptics";
import styles from "./ChatBanner.module.css";

interface ChatBannerProps {
  onOpen: () => void;
}

/**
 * Вход в чат с тарологом.
 *
 * Не иконкой в верхней панели, хотя чат и постоянное место назначения:
 * там всего два слота по краям заголовка, а главное — иконка не может
 * назвать цену. Вопрос стоит пять энергии, вдесятеро дороже бесплатной
 * суточной, и человек должен видеть это до того, как откроет экран.
 */
export function ChatBanner({ onOpen }: ChatBannerProps) {
  return (
    <button
      type="button"
      className={styles.banner}
      onClick={() => {
        hapticTap();
        onOpen();
      }}
    >
      <span className={styles.glyph} aria-hidden="true">
        🔮
      </span>
      <span className={styles.body}>
        <span className={styles.title}>Чат с тарологом</span>
        <span className={styles.text}>
          Спросите своими словами — ответит с учётом ваших раскладов
        </span>
      </span>
      <span className={styles.price}>✦ 5</span>
    </button>
  );
}
