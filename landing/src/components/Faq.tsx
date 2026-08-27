import { faq } from "../content/faq";
import { Reveal, Section, SectionIntro } from "./primitives";


export function Faq() {
  return (
    <Section id="faq">
      <SectionIntro eyebrow="Вопросы" title="Что обычно спрашивают" />

      <div className="mt-12 grid gap-3 lg:grid-cols-2">
        {faq.map((item, i) => (
          <Reveal key={item.q} index={i} step={60}>
          <details
            className="panel group rounded-2xl px-6 transition-colors duration-300 open:border-hairline-strong"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-medium text-ink marker:hidden">
              {item.q}
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-hairline text-gold-strong transition group-open:rotate-45">
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3">
                  <path
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    d="M8 3v10M3 8h10"
                  />
                </svg>
              </span>
            </summary>
            <p className="pb-5 text-[15px] leading-relaxed text-ink-muted">
              {item.a}
            </p>
          </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
