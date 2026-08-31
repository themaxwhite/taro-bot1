import {
  PLACEHOLDER,
  testimonials,
  type Testimonial,
} from "../content/testimonials";
import { Reveal, Section, SectionIntro } from "./primitives";

/** Two rows of quote cards drifting in opposite directions; hovering either
 *  row stops it so the card under the pointer can be read.
 *
 *  Пока тексты — заглушки, секции на сайте нет вообще. Показывать выдуманные
 *  благодарности как настоящие нельзя, а показывать их с плашкой «это
 *  заглушки» — значит выдавать незаконченный сайт за готовый: ровно это и
 *  читает модерация платёжной системы. Появятся настоящие отзывы —
 *  PLACEHOLDER переключается в false, и секция возвращается. */
export function Testimonials() {
  if (PLACEHOLDER) return null;

  const top = testimonials.slice(0, Math.ceil(testimonials.length / 2));
  const bottom = testimonials.slice(Math.ceil(testimonials.length / 2));

  return (
    <Section id="reviews" className="!px-0">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionIntro eyebrow="Отзывы" title="Что пишут после раскладов">
          Люди возвращаются не за предсказанием, а за формулировкой — за
          фразой, которая называет вслух уже принятое решение.
        </SectionIntro>

        {PLACEHOLDER && (
          <Reveal delay={80}>
            <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-hairline-strong bg-surface/60 px-5 py-4 text-sm text-ink-muted">
              <span className="font-semibold text-gold">Заглушки</span>
              <span>
                тексты ниже написаны для вёрстки и не являются реальными
                отзывами — замените их в{" "}
                <code className="text-ink">src/content/testimonials.ts</code>
              </span>
            </p>
          </Reveal>
        )}
      </div>

      <Reveal delay={140}>
        <div className="mt-12 space-y-6 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          <Marquee items={top} duration={68} />
          <Marquee items={bottom} duration={82} reverse />
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
  items: Testimonial[];
  duration: number;
  reverse?: boolean;
}) {
  return (
    <div className="group flex overflow-hidden">
      {/* The list is rendered twice: the first copy scrolls exactly its own
          width, the second slides in behind it, so the loop has no seam. */}
      {[0, 1].map((copy) => (
        <ul
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 gap-4 pr-4 group-hover:[animation-play-state:paused] sm:gap-6 sm:pr-6"
          style={{
            animation: `${reverse ? "marquee-reverse" : "marquee"} ${duration}s linear infinite`,
          }}
        >
          {items.map((item, i) => (
            <li key={`${item.quote}-${i}`}>
              <Card item={item} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function Card({ item }: { item: Testimonial }) {
  return (
    <figure className="panel group/card relative flex h-full w-[16.5rem] flex-col rounded-2xl p-6 transition duration-500 hover:-translate-y-1 sm:w-[23rem] sm:p-7">
      <Quote />
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-pretty text-ink">
        {item.quote}
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-hairline pt-5">
        <span className="font-display grid size-10 shrink-0 place-items-center rounded-full border border-hairline-strong text-base text-gold">
          {item.name.slice(0, 1)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">
            {item.name}
          </span>
          <span className="block truncate text-xs text-ink-faint">
            {item.context}
          </span>
        </span>
      </figcaption>
      <span className="sheen pointer-events-none absolute inset-0 rounded-2xl" />
    </figure>
  );
}

function Quote() {
  return (
    <svg
      viewBox="0 0 40 30"
      aria-hidden="true"
      className="h-6 w-8 text-gold opacity-70"
    >
      <path
        fill="currentColor"
        d="M0 30V17.4C0 7.9 5 1.6 15 0l1.8 5.1c-5.4 1.4-8.1 4.3-8.1 8.7H16V30H0Zm23.2 0V17.4C23.2 7.9 28.2 1.6 38.2 0L40 5.1c-5.4 1.4-8.1 4.3-8.1 8.7h7.3V30H23.2Z"
      />
    </svg>
  );
}
