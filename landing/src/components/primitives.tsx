import type { ReactNode } from "react";
import { useReveal } from "../hooks/useReveal";
import { site } from "../site";

/** Plain layout wrapper. Movement is opted into per block with `Reveal`, so a
 *  grid can stagger its cards instead of the whole section arriving at once. */
export function Section({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-28 ${className}`}
    >
      {children}
    </section>
  );
}

/** Fades its content up the first time it scrolls into view. `index` staggers
 *  siblings; `delay` offsets a whole block. */
export function Reveal({
  children,
  index = 0,
  delay = 0,
  step = 90,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  step?: number;
  className?: string;
}) {
  const ref = useReveal<HTMLDivElement>(delay + index * step);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-gold-strong uppercase">
      {children}
    </p>
  );
}

export function Heading({
  children,
  as: Tag = "h2",
}: {
  children: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    /* Заголовки разделов набраны золотым тиснением (.emboss-gold в
       index.css): страница про карты в тёмной обложке, и вытисненная
       фольгой строка держит этот образ лучше, чем ровный светлый текст.
       Заголовок первого экрана остаётся обычным — там уже есть своя
       игра, светлая строка против мерцающего золота, и второе золото
       рядом только сгладило бы контраст. */
    <Tag
      className={`font-display text-balance ${
        Tag === "h1"
          ? "text-ink text-4xl leading-[1.08] sm:text-6xl"
          : "emboss-gold text-[1.7rem] leading-tight sm:text-4xl"
      }`}
    >
      {children}
    </Tag>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
      {children}
    </p>
  );
}

/** Section intro — eyebrow, heading and optional lead — revealed as one block. */
export function SectionIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Reveal>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading>{title}</Heading>
      {children ? <Lead>{children}</Lead> : null}
    </Reveal>
  );
}

export function OpenInTelegram({
  size = "md",
  children = "Открыть в Telegram",
}: {
  size?: "md" | "lg";
  children?: ReactNode;
}) {
  return (
    <a
      href={site.botUrl}
      target="_blank"
      rel="noreferrer"
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gold font-semibold text-on-gold shadow-[0_10px_30px_-12px_var(--gold-strong)] transition duration-300 hover:-translate-y-0.5 hover:bg-gold-strong hover:shadow-[0_18px_40px_-14px_var(--gold-strong)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-gold-strong active:translate-y-0 ${
        size === "lg" ? "px-8 py-4 text-base" : "px-5 py-2.5 text-sm"
      }`}
    >
      <TelegramGlyph className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      {children}
      <span className="sheen pointer-events-none absolute inset-0 rounded-full" />
    </a>
  );
}

export function TelegramGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M21.9 4.3 18.7 19.4c-.24 1.06-.87 1.32-1.76.82l-4.87-3.59-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.03-8.16c.39-.35-.09-.55-.6-.2L6.36 13.09l-4.8-1.5c-1.04-.33-1.06-1.04.22-1.54l18.78-7.24c.87-.32 1.63.2 1.34 1.49Z"
      />
    </svg>
  );
}
