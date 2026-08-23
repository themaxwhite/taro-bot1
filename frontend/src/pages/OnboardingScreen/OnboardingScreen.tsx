import { useState } from "react";
import { completeOnboarding, type Gender, type ZodiacSign } from "../../services/historyApi";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import styles from "./OnboardingScreen.module.css";

interface OnboardingScreenProps {
  onComplete: () => void;
}

const ZODIAC_SIGNS: { id: ZodiacSign; symbol: string; title: string }[] = [
  { id: "aries", symbol: "♈", title: "Овен" },
  { id: "taurus", symbol: "♉", title: "Телец" },
  { id: "gemini", symbol: "♊", title: "Близнецы" },
  { id: "cancer", symbol: "♋", title: "Рак" },
  { id: "leo", symbol: "♌", title: "Лев" },
  { id: "virgo", symbol: "♍", title: "Дева" },
  { id: "libra", symbol: "♎", title: "Весы" },
  { id: "scorpio", symbol: "♏", title: "Скорпион" },
  { id: "sagittarius", symbol: "♐", title: "Стрелец" },
  { id: "capricorn", symbol: "♑", title: "Козерог" },
  { id: "aquarius", symbol: "♒", title: "Водолей" },
  { id: "pisces", symbol: "♓", title: "Рыбы" },
];

// One-time gate before the main menu — gender, then zodiac sign. Both
// are persisted server-side (see api/history.py::complete_onboarding)
// so App.tsx skips straight to MainScreen on every later open.
export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [gender, setGender] = useState<Gender | null>(null);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenderSelect(value: Gender) {
    setGender(value);
    setStep(2);
  }

  async function handleFinish() {
    if (!gender || !zodiacSign) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboarding(gender, zodiacSign);
      onComplete();
    } catch {
      setError("Не удалось сохранить. Попробуйте ещё раз.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.screen}>
      <MysticalBackground />

      <div className={styles.progress} aria-hidden="true">
        <span className={`${styles.dot} ${step >= 1 ? styles.dotActive : ""}`} />
        <span className={`${styles.dot} ${step >= 2 ? styles.dotActive : ""}`} />
      </div>

      {step === 1 && (
        <div className={styles.step}>
          <span className={styles.glyph} aria-hidden="true">
            🔮
          </span>
          <h1 className={styles.title}>Добро пожаловать в Tarot Aurum</h1>
          <p className={styles.subtitle}>Расскажите немного о себе — это поможет точнее толковать карты</p>

          <div className={styles.genderRow}>
            <button type="button" className={styles.genderCard} onClick={() => handleGenderSelect("male")}>
              <span className={styles.genderIcon} aria-hidden="true">
                ♂
              </span>
              <span>Мужской</span>
            </button>
            <button type="button" className={styles.genderCard} onClick={() => handleGenderSelect("female")}>
              <span className={styles.genderIcon} aria-hidden="true">
                ♀
              </span>
              <span>Женский</span>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.step}>
          <h1 className={styles.title}>Ваш знак зодиака</h1>
          <p className={styles.subtitle}>Тоже учитывается в толкованиях — выберите свой</p>

          <div className={styles.zodiacGrid}>
            {ZODIAC_SIGNS.map((sign) => (
              <button
                key={sign.id}
                type="button"
                className={`${styles.zodiacCard} ${zodiacSign === sign.id ? styles.zodiacSelected : ""}`}
                onClick={() => setZodiacSign(sign.id)}
              >
                <span className={styles.zodiacSymbol} aria-hidden="true">
                  {sign.symbol}
                </span>
                <span className={styles.zodiacTitle}>{sign.title}</span>
              </button>
            ))}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.continueButton}
            disabled={!zodiacSign || submitting}
            onClick={handleFinish}
          >
            {submitting ? "Сохраняем…" : "Готово"}
          </button>
        </div>
      )}
    </div>
  );
}
