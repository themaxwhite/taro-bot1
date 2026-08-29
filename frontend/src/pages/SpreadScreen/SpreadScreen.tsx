import { useState } from "react";
import { SPREAD_TYPES, type SpreadId } from "../../types/tarot";
import { ScreenHeader } from "../../components/ScreenHeader/ScreenHeader";
import { Deck } from "../../components/Deck/Deck";
import { checkQuestion } from "../../services/spreadsApi";
import { MysticalBackground } from "../../components/MysticalBackground/MysticalBackground";
import { SPREAD_GUIDES } from "../../content/spreadGuides";
import styles from "./SpreadScreen.module.css";

interface SpreadScreenProps {
  spreadId: SpreadId;
  onBack: () => void;
  onCardsSelected: (spreadId: SpreadId, question: string) => void;
}

// Visual deck size — a representative subset shown to the user, not the
// full 78-card tarot deck (keeps the grid usable on small screens).
const VISUAL_DECK_SIZE = 20;

// Справка сворачивается на этом устройстве и больше не разворачивается
// сама: первый раз она нужна, на десятый — мешает между человеком и
// колодой. localStorage может быть недоступен (приватное окно, отказ от
// хранилища), поэтому любое обращение обёрнуто — тогда справка просто
// открыта, как в первый раз.
const GUIDE_SEEN_KEY = "tarot:spread-guide-collapsed";

function guideCollapsed(spreadId: SpreadId): boolean {
  try {
    return (localStorage.getItem(GUIDE_SEEN_KEY) ?? "").split(",").includes(spreadId);
  } catch {
    return false;
  }
}

function rememberCollapsed(spreadId: SpreadId): void {
  try {
    const seen = new Set((localStorage.getItem(GUIDE_SEEN_KEY) ?? "").split(",").filter(Boolean));
    seen.add(spreadId);
    localStorage.setItem(GUIDE_SEEN_KEY, [...seen].join(","));
  } catch {
    // Не смогли запомнить — справка снова откроется, это не поломка.
  }
}

export function SpreadScreen({ spreadId, onBack, onCardsSelected }: SpreadScreenProps) {
  const spread = SPREAD_TYPES.find((s) => s.id === spreadId);
  const guide = SPREAD_GUIDES[spreadId];
  const [guideOpen, setGuideOpen] = useState(() => !guideCollapsed(spreadId));
  const [question, setQuestion] = useState("");
  // Текст отказа от бэкенда, если вопрос попал под ограничения
  // (backend/app/moderation.py). Проверка серверная — здесь только
  // показываем причину рядом с полем, где её и ждут.
  const [questionError, setQuestionError] = useState<string | null>(null);

  if (!spread) {
    // Defensive fallback — shouldn't happen since spreadId always comes
    // from SPREAD_TYPES, but keeps the component total.
    return (
      <div className={styles.screen}>
        <ScreenHeader title="Расклад" onBack={onBack} />
        <p className={styles.error}>Расклад не найден</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <MysticalBackground density="subtle" />
      <ScreenHeader title={spread.title} onBack={onBack} />
      <p className={styles.description}>{spread.description}</p>

      <div className={styles.guide}>
        <button
          type="button"
          className={styles.guideToggle}
          aria-expanded={guideOpen}
          onClick={() => {
            const next = !guideOpen;
            setGuideOpen(next);
            if (!next) rememberCollapsed(spreadId);
          }}
        >
          <span>Как работать с этим раскладом</span>
          <span className={`${styles.guideChevron} ${guideOpen ? styles.guideChevronOpen : ""}`} aria-hidden="true">
            ›
          </span>
        </button>

        {guideOpen && (
          <dl className={styles.guideBody}>
            <dt className={styles.guideTerm}>Для чего</dt>
            <dd className={styles.guideText}>{guide.about}</dd>
            <dt className={styles.guideTerm}>Что спросить</dt>
            <dd className={styles.guideText}>{guide.ask}</dd>
            <dt className={styles.guideTerm}>Как читать</dt>
            <dd className={styles.guideText}>{guide.read}</dd>
          </dl>
        )}
      </div>

      {/* Ни подписи, ни примера: подсказка навязывала формулировку, и
          люди переписывали пример вместо собственного вопроса. Экранная
          подпись всё же нужна для доступности — но невидимая, чтобы
          скринридер объявил поле, а глазу ничего не диктовалось. */}
      <label className={styles.visuallyHidden} htmlFor="spread-question">
        Ваш вопрос к раскладу
      </label>
      <textarea
        id="spread-question"
        className={styles.questionInput}
        value={question}
        maxLength={500}
        rows={2}
        onChange={(e) => {
          setQuestion(e.target.value);
          if (questionError) setQuestionError(null);
        }}
        // Проверяем, как только человек ушёл из поля: так причина отказа
        // видна сразу, а не после того, как он вытянул карты.
        onBlur={async (e) => {
          const trimmed = e.target.value.trim();
          if (trimmed) setQuestionError(await checkQuestion(trimmed));
        }}
      />
      {questionError && <p className={styles.questionError}>{questionError}</p>}

      <Deck
        totalCards={VISUAL_DECK_SIZE}
        requiredCount={spread.cardCount}
        onSelectionComplete={async () => {
          const trimmed = question.trim();
          // Проверяем прежде, чем уйти на экран результата: там вопрос
          // уже не исправить, а розыгрыш всё равно бы его отклонил.
          const reason = trimmed ? await checkQuestion(trimmed) : null;
          if (reason) {
            setQuestionError(reason);
            return;
          }
          onCardsSelected(spread.id, trimmed);
        }}
      />
    </div>
  );
}
