import { Reveal, Section, SectionIntro } from "./primitives";

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
];

export function Spreads() {
  return (
    <Section id="spreads">
      <SectionIntro eyebrow="Расклады" title="Три расклада на каждый день">
        Никаких платных «премиум-колод» ради базового ответа: все три расклада
        доступны бесплатно и без ограничения по количеству.
      </SectionIntro>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {spreads.map((spread, i) => (
          <Reveal key={spread.name} index={i} delay={80}>
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
    </Section>
  );
}
