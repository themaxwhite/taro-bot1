import { Reveal, Section, SectionIntro } from "./primitives";

/* Все тринадцать раскладов приложения (backend/app/spreads.py).
   Названия и число карт сверены с ним. */
type Spread = {
  card: string;
  name: string;
  cards: string;
  text: string;
};

const spreads: Spread[] = [
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

/**
 * Расклады едут двумя лентами навстречу друг другу — тем же приёмом, что
 * и отзывы.
 *
 * Так снимаются обе беды прежней вёрстки: сетка из трёх карточек занижала
 * продукт вчетверо, а показать все тринадцать разом значило поставить
 * стену, через которую никто не пролистает. Движение показывает всё, не
 * требуя ни прокрутки, ни нажатия.
 *
 * Кнопка «показать все» отсюда убрана: раскрывать больше нечего — мимо и
 * так проезжают все тринадцать.
 */
export function Spreads() {
  const half = Math.ceil(spreads.length / 2);
  const top = spreads.slice(0, half);
  const bottom = spreads.slice(half);

  return (
    <Section id="spreads" className="!px-0">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionIntro eyebrow="Расклады" title="Тринадцать раскладов на любой вопрос">
          От карты дня и быстрого «да или нет» до Кельтского креста. Карта дня
          бесплатна всегда, остальные открываются за энергию — одна приходит
          каждые сутки.
        </SectionIntro>
      </div>

      <Reveal delay={140}>
        <div className="mt-12 space-y-6 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          {/* Разные длительности, чтобы ленты не шли в такт и рисунок
              движения не повторялся каждые несколько секунд. */}
          <Marquee items={top} duration={74} />
          <Marquee items={bottom} duration={88} reverse />
        </div>
      </Reveal>
    </Section>
  );
}

function Marquee({
  items,
  duration,
  reverse = false,
}: {
  items: Spread[];
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div className="group flex overflow-hidden">
      {/* Список отрисован дважды: первая копия уезжает ровно на свою
          ширину, вторая заходит следом — петля без шва. Вторая копия
          скрыта от скринридера, иначе он прочитает расклады дважды. */}
      {[0, 1].map((copy) => (
        <ul
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 gap-4 pr-4 group-hover:[animation-play-state:paused] sm:gap-6 sm:pr-6"
          style={{
            animation: `${reverse ? "marquee-reverse" : "marquee"} ${duration}s linear infinite`,
          }}
        >
          {items.map((spread) => (
            <li key={spread.name} className="w-[264px] sm:w-[320px]">
              <Card spread={spread} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function Card({ spread }: { spread: Spread }) {
  return (
    <article className="panel group/card relative flex h-full flex-col overflow-hidden rounded-3xl p-7 transition duration-500 hover:border-hairline-strong hover:shadow-[0_40px_80px_-50px_var(--gold)]">
      <img
        src={spread.card}
        alt=""
        width={480}
        height={720}
        loading="lazy"
        decoding="async"
        className="card-art mb-6 w-24 rounded-xl border border-hairline shadow-[0_18px_36px_-20px_#000] transition duration-500 group-hover/card:-translate-y-1 group-hover/card:rotate-6"
      />
      <h3 className="font-display text-2xl text-ink">{spread.name}</h3>
      <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-gold-strong uppercase">
        {spread.cards}
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">{spread.text}</p>
      <span className="sheen pointer-events-none absolute inset-0 rounded-3xl" />
    </article>
  );
}
