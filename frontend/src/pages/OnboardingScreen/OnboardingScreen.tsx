import { useState } from "react";
import { completeOnboarding, type Gender, type ZodiacSign } from "../../services/historyApi";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { hasNativeMainButton, useTelegramMainButton } from "../../hooks/useTelegramMainButton";
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

// Вводные экраны идут перед вопросами о себе: до них человек не знает,
// что это за приложение, и просьба указать пол и знак зодиака выглядит
// как анкета на пустом месте. Первым делом — что такое расклад, потом
// уже данные для него.
const INTRO_STEPS: { glyph: string; title: string; paragraphs: string[] }[] = [
  {
    glyph: "🔮",
    title: "Добро пожаловать в Tarot Aurum",
    paragraphs: [
      "Колода — 78 карт. 22 старших аркана говорят о крупных поворотах, 56 младших — о повседневном.",
      "Расклад — это несколько карт, каждая на своей позиции, и толкование, которое связывает их в один ответ на ваш вопрос.",
    ],
  },
  {
    glyph: "🌗",
    title: "Перевёрнутые карты",
    paragraphs: [
      "Карта может лечь вверх ногами — это не делает её «плохой».",
      "Перевёрнутое положение разворачивает смысл: то же качество, но ослабленное, запаздывающее или обращённое внутрь, а не наружу.",
    ],
  },
  {
    glyph: "✦",
    title: "Энергия",
    paragraphs: [
      "Расклад открывается за одну энергию — карты вместе с толкованием. Столько же стоит дополнительная карта или уточняющий вопрос.",
      "Одна энергия начисляется бесплатно каждый день. Больше дают подписка и приглашённые друзья, а карта дня бесплатна всегда.",
    ],
  },
];

const GENDER_STEP = INTRO_STEPS.length + 1;
const ZODIAC_STEP = GENDER_STEP + 1;
const TOTAL_STEPS = ZODIAC_STEP;

// One-time gate before the main menu — a short intro, then gender and
// zodiac sign. Both answers are persisted server-side (see
// api/history.py::complete_onboarding) so App.tsx skips straight to
// MainScreen on every later open.
export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<Gender | null>(null);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenderSelect(value: Gender) {
    setGender(value);
    setStep(ZODIAC_STEP);
  }

  // Каждый шаг, кроме выбора пола, имеет ровно одно действие — это и
  // есть случай нативной главной кнопки. На шаге с полом её нет:
  // выбор карточки сам ведёт дальше, и кнопке внизу нечего было бы
  // делать.
  const native = hasNativeMainButton();
  const isIntro = step <= INTRO_STEPS.length;
  useTelegramMainButton({
    text: isIntro ? "Дальше" : "Готово",
    onClick: () => (isIntro ? setStep((current) => current + 1) : void handleFinish()),
    visible: step !== GENDER_STEP,
    disabled: isIntro ? false : !zodiacSign || submitting,
    progress: submitting,
  });

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
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span key={i} className={`${styles.dot} ${step >= i + 1 ? styles.dotActive : ""}`} />
        ))}
      </div>

      {isIntro && (
        <div className={styles.step} key={step}>
          <span className={styles.glyph} aria-hidden="true">
            {INTRO_STEPS[step - 1].glyph}
          </span>
          <h1 className={styles.title}>{INTRO_STEPS[step - 1].title}</h1>
          {INTRO_STEPS[step - 1].paragraphs.map((text) => (
            <p key={text} className={styles.introParagraph}>
              {text}
            </p>
          ))}

          {!native && (
            <button type="button" className={styles.continueButton} onClick={() => setStep(step + 1)}>
              Дальше
            </button>
          )}
        </div>
      )}

      {step === GENDER_STEP && (
        <div className={styles.step}>
          <h1 className={styles.title}>Расскажите о себе</h1>
          <p className={styles.subtitle}>Пол и знак зодиака учитываются в толковании карт</p>

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

      {step === ZODIAC_STEP && (
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

          {/* Outside Telegram there is no sheet to pin a button to, so
              the in-flow one is still the only way to finish. */}
          {!native && (
            <button
              type="button"
              className={styles.continueButton}
              disabled={!zodiacSign || submitting}
              onClick={handleFinish}
            >
              {submitting ? "Сохраняем…" : "Готово"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
