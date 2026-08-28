import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { GUIDE_SECTIONS } from "../../content/guide";
import styles from "./GuideScreen.module.css";

interface GuideScreenProps {
  onBack: () => void;
}

/**
 * Справка по приложению, открывается из профиля.
 *
 * Первые её разделы — те же, что новичок видит в онбординге
 * (content/guide.ts). Онбординг показывается ровно один раз и обычно
 * пролистывается, так что без этого экрана объяснение, что такое
 * энергия и почему карта легла вверх ногами, не существовало нигде.
 */
export function GuideScreen({ onBack }: GuideScreenProps) {
  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title="Как это работает" onBack={onBack} />

      <div className={styles.content}>
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.title} className={styles.section}>
            <span className={styles.glyph} aria-hidden="true">
              {section.glyph}
            </span>
            <div className={styles.body}>
              <h2 className={styles.heading}>{section.title}</h2>
              {section.paragraphs.map((text) => (
                <p key={text} className={styles.paragraph}>
                  {text}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
