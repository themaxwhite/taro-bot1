import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import styles from "./TermsScreen.module.css";

interface TermsScreenProps {
  onBack: () => void;
}

// Placeholder — real Terms of Use / Privacy Policy text goes here before
// launch. Not something to generate automatically: it's a legal
// document and needs to accurately describe what this specific app
// actually does with user data (Telegram profile, spread history, AI
// providers, ЮKassa payments).
export function TermsScreen({ onBack }: TermsScreenProps) {
  return (
    <div className={styles.screen}>
      <ScreenHeader title="Условия использования" onBack={onBack} />
      <div className={styles.content}>
        <p className={styles.placeholder}>
          Здесь появится полный текст условий использования и политики
          конфиденциальности Tarot Aurum.
        </p>
        <p className={styles.hint}>
          Пока страница пустая — актуальный текст ещё не подготовлен.
        </p>
      </div>
    </div>
  );
}
