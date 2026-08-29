import { useState } from "react";
import { Reveal, Section, SectionIntro } from "./primitives";

/* Все тринадцать раскладов приложения (backend/app/spreads.py). Первые
   три показываются сразу, остальные раскрываются по кнопке: тринадцать
   карточек подряд — это стена, через которую никто не пролистает, а
   три ничего не говорят о размере колоды раскладов. */
const spreads = [
  {
    card: "/cards/major-19.webp",
    name: "Карта дня",
    cards: "1 карта",
    text: "Одна карта на календарные сутки. Она фиксируется до полуночи UTC — вернуться и перевыпасть «поудачнее» не получится.",
  },
  {
    card: "/cards/major-06.webp",
    name: "Любовь",
    cards: "3 карты",
    text: "Что происходит сейчас, что этому мешает и к чему всё идёт. Можно задать конкретный вопрос — толкование его учтёт.",
  },
  {
    card: "/cards/major-21.webp",
    name: "Будущее",
    cards: "3 карты",
    text: "Ближняя перспектива: развитие ситуации, скрытый фактор и итог. Прямые и перевёрнутые положения читаются по-разному.",
  },
  {
    card: "/cards/major-11.webp",
    name: "Да или нет",
    cards: "1 карта",
    text: "Быстрый ответ, когда решение почти принято и нужен толчок. Прямое положение — скорее да, перевёрнутое — скорее нет.",
  },
  {
    card: "/cards/major-03.webp",
    name: "Совместимость",
    cards: "5 карт",
    text: "Расклад на двоих: вы, партнёр, что вас связывает, где трудности и есть ли у этого потенциал.",
  },
  {
    card: "/cards/major-01.webp",
    name: "Работа и деньги",
    cards: "4 карты",
    text: "Где вы сейчас, что мешает, какую возможность вы не замечаете и что с этим делать.",
  },
  {
    card: "/cards/major-14.webp",
    name: "Два пути",
    cards: "5 карт",
    text: "Когда выбираете из двух вариантов: что даст каждый и чего будет стоить. Не «какой правильный», а «чем платить».",
  },
  {
    card: "/cards/major-02.webp",
    name: "Зеркало",
    cards: "4 карты",
    text: "Каким вы себя видите, каким вас видят другие, что вы прячете и что стоит принять.",
  },
  {
    card: "/cards/major-10.webp",
    name: "Неделя",
    cards: "7 карт",
    text: "Карта на каждый день от понедельника до воскресенья — и то, как дни складываются друг за другом.",
  },
  {
    card: "/cards/major-18.webp",
    name: "Месяц впереди",
    cards: "4 карты",
    text: "Начало, середина и конец месяца, а четвёртая карта — тема, которая проходит через все три.",
  },
  {
    card: "/cards/major-07.webp",
    name: "Путь",
    cards: "6 карт",
    text: "Про движение, а не про ситуацию: откуда идёте, что ведёт, что держит и куда это приведёт.",
  },
  {
    card: "/cards/major-17.webp",
    name: "Подкова",
    cards: "7 карт",
    text: "Классический расклад: прошлое, настоящее, скрытые влияния, препятствия, окружение, совет и итог.",
  },
  {
    card: "/cards/major-20.webp",
    name: "Кельтский крест",
    cards: "10 карт",
    text: "Самый подробный разбор одной ситуации: от её основы и вызова до надежд, страхов и вероятного исхода.",
  },
];

const PREVIEW_COUNT = 3;

export function Spreads() {
  const [expanded, setExpanded] = useState(false);
  const hidden = spreads.length - PREVIEW_COUNT;

  return (
    <Section id="spreads">
      <SectionIntro eyebrow="Расклады" title="Тринадцать раскладов на любой вопрос">
        От карты дня и быстрого «да или нет» до Кельтского креста. Карта дня
        бесплатна всегда, остальные открываются за энергию — одна приходит
        каждые сутки.
      </SectionIntro>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Рисуются все тринадцать, лишние скрыты атрибутом hidden, а не
            выброшены из разметки. Страница пререндерится ради поиска
            (scripts/prerender.mjs), и расклады, появляющиеся только по
            клику, в готовый HTML бы не попали — десять из тринадцати
            остались бы невидимы для поисковика. */}
        {spreads.map((spread, i) => (
          <Reveal
            key={spread.name}
            index={i < PREVIEW_COUNT ? i : i - PREVIEW_COUNT}
            delay={80}
            className={!expanded && i >= PREVIEW_COUNT ? "hidden" : ""}
          >
            <article className="panel group relative flex h-full flex-col overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1.5 hover:border-hairline-strong hover:shadow-[0_40px_80px_-50px_var(--gold)]">
              <img
                src={spread.card}
                alt=""
                width={480}
                height={720}
                loading="lazy"
                decoding="async"
                className="card-art mb-6 w-24 rounded-xl border border-hairline shadow-[0_18px_36px_-20px_#000] transition duration-500 group-hover:-translate-y-1 group-hover:rotate-6"
              />
              <h3 className="font-display text-2xl text-ink">{spread.name}</h3>
              <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-gold-strong uppercase">
                {spread.cards}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                {spread.text}
              </p>
              <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
            </article>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="group inline-flex items-center gap-2.5 rounded-full border border-hairline px-6 py-3.5 text-base font-medium text-ink transition duration-300 hover:-translate-y-0.5 hover:border-hairline-strong hover:bg-surface"
        >
          {expanded ? "Свернуть" : `Показать все ${spreads.length} раскладов`}
          <span
            aria-hidden="true"
            className={`text-gold transition-transform duration-300 ${
              expanded ? "-translate-y-0.5 rotate-180" : "group-hover:translate-y-0.5"
            }`}
          >
            ↓
          </span>
        </button>
      </div>

      {!expanded && (
        <p className="mt-4 text-center text-[13px] text-ink-faint">
          Ещё {hidden}: работа, выбор между вариантами, неделя, месяц, Кельтский крест
        </p>
      )}
    </Section>
  );
}
