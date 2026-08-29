import { site } from "../site";
import { useCountUp } from "../hooks/useCountUp";
import { useTilt } from "../hooks/useTilt";
import { GoldDust } from "./GoldDust";
import { OpenInTelegram, Reveal } from "./primitives";

/* The three cards fanned beside the headline. Faces are the real deck art from
   the Mini App, so the landing shows the product, not a mock-up. */
const fan = [
  { src: "/cards/major-17.webp", alt: "Звезда", tilt: -13, x: -1, delay: 0 },
  { src: "/cards/major-19.webp", alt: "Солнце", tilt: 0, x: 0, delay: 900 },
  { src: "/cards/major-10.webp", alt: "Колесо Фортуны", tilt: 13, x: 1, delay: 1800 },
];

/* Числа сверены с приложением: 78 карт (app/tarot/cards.py), 13 раскладов
   (app/spreads.py — 12 выбираемых плюс карта дня), карта дня бесплатна и
   не тратит энергию (api/spreads.py). Раньше здесь стояло «3 типа
   расклада» — цифра времён первой версии, занижавшая продукт вчетверо. */
const stats = [
  { value: site.deckSize, suffix: "", label: "карт в колоде" },
  { value: 13, suffix: "", label: "раскладов" },
  { value: 0, suffix: " ₽", label: "карта дня" },
];

export function Hero() {
  /* The pointer is tracked across the whole hero, so the cards start leaning
     while it is still over the text. */
  const { ref: fanRef, areaRef } = useTilt<HTMLDivElement, HTMLDivElement>({
    max: 12,
    shift: 16,
  });

  return (
    <div id="top" ref={areaRef} className="relative overflow-hidden">
      <GoldDust />
      <div className="mx-auto grid w-full max-w-6xl gap-14 px-5 pt-16 pb-24 sm:px-8 sm:pt-24 sm:pb-36 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-8">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-hairline bg-surface/60 px-4 py-1.5 text-xs font-medium tracking-wide text-ink-muted backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-gold" />
              </span>
              Telegram Mini App · без установки
            </p>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="font-display mt-7 text-[2rem] leading-[1.06] text-balance text-ink min-[400px]:text-[2.4rem] sm:text-[3.2rem] lg:text-[4.2rem]">
              Карты уже знают.
              <br />
              <span className="shimmer-gold">Осталось спросить.</span>
            </h1>
          </Reveal>

          <Reveal delay={220}>
            <div className="rule-gold mt-8 max-w-sm" />
          </Reveal>

          <Reveal delay={280}>
            <p className="mt-8 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
              Тринадцать раскладов — от карты дня и быстрого «да или нет» до
              Кельтского креста, — иллюстрированная колода из {site.deckSize} карт
              и толкование, собранное вокруг вашего вопроса. Можно спросить
              таролога своими словами в чате. Открывается прямо в Telegram,
              ставить нечего.
            </p>
          </Reveal>

          <Reveal delay={380}>
            <div className="mt-10 flex flex-col items-stretch gap-3 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center min-[400px]:gap-4">
              <OpenInTelegram size="lg">Сделать расклад</OpenInTelegram>
              <a
                href="#answers"
                className="group inline-flex items-center justify-center gap-2 rounded-full border border-hairline px-6 py-4 text-base font-medium text-ink transition duration-300 hover:-translate-y-0.5 hover:border-hairline-strong hover:bg-surface"
              >
                Посмотреть ответ
                <span className="text-gold transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={480}>
            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-4 border-t border-hairline pt-8 sm:gap-6">
              {stats.map((stat) => (
                <Stat key={stat.label} {...stat} />
              ))}
            </dl>
          </Reveal>
        </div>

        <div className="relative flex h-[268px] items-center justify-center min-[400px]:h-[320px] sm:h-[460px]">
          <Smoke />
          {/* Pool of light the cards sit in. */}
          <div
            aria-hidden="true"
            className="absolute size-[26rem] rounded-full opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in srgb, var(--gold) 22%, transparent), transparent 65%)",
            }}
          />
          <div
            ref={fanRef}
            className="tilt absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]"
          >
            {fan.map((card) => (
              <span
                key={card.src}
                className="glare float-slow group absolute w-28 overflow-hidden rounded-2xl border border-hairline-strong shadow-[0_40px_80px_-30px_#000] min-[400px]:w-32 sm:w-52"
                style={{
                  translate: `${card.x * 42}%`,
                  rotate: `${card.tilt}deg`,
                  animationDelay: `${card.delay}ms`,
                  zIndex: card.tilt === 0 ? 3 : 1,
                }}
              >
                <img
                  src={card.src}
                  alt={card.alt}
                  width={480}
                  height={720}
                  decoding="async"
                  fetchPriority={card.tilt === 0 ? "high" : undefined}
                  className="card-art block h-auto w-full"
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  suffix,
  label,
}: {
  value: number;
  suffix: string;
  label: string;
}) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div>
      <dt className="font-display text-2xl text-gold sm:text-3xl">
        <span ref={ref}>{shown}</span>
        {suffix}
      </dt>
      <dd className="mt-1 text-[13px] leading-snug text-ink-muted sm:text-sm">{label}</dd>
    </div>
  );
}

/** Three columns of smoke curling up behind the cards. */
function Smoke() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {[
        { left: "22%", delay: "0s", width: "9rem" },
        { left: "48%", delay: "5s", width: "12rem" },
        { left: "72%", delay: "9s", width: "8rem" },
      ].map((wisp) => (
        <span
          key={wisp.left}
          className="smoke absolute bottom-6 h-40 rounded-full blur-2xl"
          style={{
            left: wisp.left,
            width: wisp.width,
            animationDelay: wisp.delay,
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--mist) 30%, transparent), transparent 70%)",
          }}
        />
      ))}
    </div>
  );
}
