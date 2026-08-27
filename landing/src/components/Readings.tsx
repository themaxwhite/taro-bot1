import { useState } from "react";
import { cardSrc } from "../deck";
import { readings } from "../content/readings";
import { OpenInTelegram, Reveal, Section, SectionIntro } from "./primitives";

/** Worked examples of a finished reading: the question someone asked, the
 *  cards that fell, and the answer written for them. Tabs across the top swap
 *  between three spreads. */
export function Readings() {
  const [active, setActive] = useState(0);
  const reading = readings[active]!;

  return (
    <Section id="answers">
      <SectionIntro eyebrow="Ответ" title="Как отвечает расклад">
        Не «Звезда — надежда, Луна — тревога». Толкование собирается вокруг
        вашего вопроса и того, как карты легли друг относительно друга. Ниже —
        три примера целиком.
      </SectionIntro>

      <Reveal delay={120}>
        <div
          role="tablist"
          aria-label="Примеры раскладов"
          className="mt-10 flex flex-wrap gap-2"
        >
          {readings.map((item, i) => (
            <button
              key={item.spread}
              role="tab"
              type="button"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-full border px-5 py-2.5 text-sm font-medium transition duration-300 ${
                i === active
                  ? "border-gold bg-gold text-on-gold"
                  : "border-hairline text-ink-muted hover:border-hairline-strong hover:text-ink"
              }`}
            >
              {item.spread}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={200}>
        <article className="panel mt-6 overflow-hidden rounded-3xl">
          <div className="border-b border-hairline px-5 py-7 text-center sm:px-10 sm:py-9">
            <p className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Вопрос
            </p>
            <p className="font-display mx-auto mt-3 max-w-2xl text-xl leading-snug text-balance text-ink sm:text-3xl">
              «{reading.question}»
            </p>
          </div>

          <div className="px-5 py-8 sm:px-10 sm:py-10">
            {/* Cards sit on their own row, centred. Putting the reading beside
                them starved the text column on narrower screens — a reading is
                a paragraph, and it needs the full width to be one. */}
            <div className="flex flex-nowrap justify-center gap-3 min-[400px]:gap-5 sm:gap-8">
              {reading.cards.map((card) => (
                <figure
                  key={card.id}
                  className="group w-[5.4rem] text-center min-[400px]:w-24 sm:w-36 lg:w-40"
                >
                  <div className="relative overflow-hidden rounded-xl border border-hairline shadow-[0_26px_50px_-26px_#000]">
                    <img
                      src={cardSrc(card.id)}
                      alt={card.name}
                      width={480}
                      height={720}
                      loading="lazy"
                      decoding="async"
                      className="card-art block h-auto w-full"
                      style={{ rotate: card.reversed ? "180deg" : undefined }}
                    />
                    <span className="sheen pointer-events-none absolute inset-0" />
                  </div>
                  <figcaption className="mt-3">
                    <span className="block text-[12px] font-medium text-ink sm:text-[13px]">
                      {card.name}
                      {card.reversed ? " ⟲" : ""}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight tracking-[0.1em] text-ink-faint uppercase sm:text-[11px]">
                      {card.position}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="rule-gold mt-10" />

            <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-3 sm:gap-x-8">
              {reading.cards.map((card) => (
                <li
                  key={card.id}
                  className="max-w-xs text-center text-[13px] leading-relaxed text-ink-muted"
                >
                  <span className="text-gold">{card.name}</span>
                  {card.reversed ? " (перевёрнута)" : ""} — {card.gist}
                </li>
              ))}
            </ul>

            <p className="caret mx-auto mt-9 max-w-3xl text-[16px] leading-[1.7] text-pretty text-ink sm:text-lg sm:leading-[1.75]">
              {reading.answer}
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 border-t border-hairline pt-8 sm:flex-row sm:justify-center">
              <OpenInTelegram>Спросить о своём</OpenInTelegram>
              <p className="text-center text-xs text-ink-faint">
                Пример толкования. Ваш ответ будет о вашем вопросе.
              </p>
            </div>
          </div>
        </article>
      </Reveal>
    </Section>
  );
}
