import { useEffect, useState } from "react";
import { PLACEHOLDER } from "../content/testimonials";
import { site } from "../site";
import { OpenInTelegram } from "./primitives";
import { ScrollProgress } from "./ScrollProgress";

/* Пункт «Отзывы» показывается только вместе с секцией отзывов: пока там
   заглушки, секция не выводится (см. Testimonials.tsx), и ссылка на
   несуществующий якорь просто не прокручивала бы страницу никуда. */
const links = [
  { href: "#spreads", label: "Расклады" },
  { href: "#answers", label: "Ответ" },
  { href: "#draw", label: "Вытянуть карту" },
  { href: "#deck", label: "Колода" },
  ...(PLACEHOLDER ? [] : [{ href: "#reviews", label: "Отзывы" }]),
  { href: "#pricing", label: "Оплата" },
  { href: "#faq", label: "Вопросы" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* An open menu that scrolls with the page behind it is worse than no menu. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-500 ${
        scrolled || open
          ? "border-b border-hairline bg-page/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      {/* Оферта и политика обработки данных вынесены над навигацией и видны
          на любом экране, а не только в подвале. Так их находит и человек,
          который решает, платить ли, и модерация платёжной системы, которая
          первым делом ищет на сайте ровно эти два документа. Полоска живёт
          внутри залипающей шапки, то есть не уезжает при прокрутке. */}
      <div className="border-b border-hairline/60 bg-surface/40">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-1.5 text-[11px] sm:gap-6 sm:px-8 sm:text-xs">
          <span className="hidden shrink-0 uppercase tracking-[0.14em] text-gold sm:inline">
            Документы
          </span>
          <a
            href="/oferta.html"
            className="shrink-0 text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
          >
            Публичная оферта
          </a>
          <a
            href="/privacy.html"
            className="shrink-0 text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
          >
            Обработка персональных данных
          </a>
          <a
            href={`mailto:${site.email}`}
            className="ml-auto hidden shrink-0 text-ink-muted underline-offset-4 transition hover:text-ink hover:underline lg:inline"
          >
            {site.email}
          </a>
        </div>
      </div>

      <nav className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-4 sm:gap-6 sm:px-8">
        <a
          href="#top"
          onClick={() => setOpen(false)}
          className="group flex shrink-0 items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          <Sigil />
          <span className="font-display text-lg tracking-wide text-ink">
            {site.name}
          </span>
        </a>

        <ul className="ml-auto hidden items-center gap-7 text-sm text-ink-muted xl:flex">
          {links.slice(0, 6).map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="relative transition hover:text-ink after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-gold after:transition-all after:duration-300 hover:after:w-full"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* The full label does not fit next to the wordmark on a 360px screen,
            so the button keeps only the verb there. */}
        <div className="ml-auto xl:ml-0">
          <OpenInTelegram>
            <span className="sm:hidden">Открыть</span>
            <span className="hidden sm:inline">Открыть в Telegram</span>
          </OpenInTelegram>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="nav-menu"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-hairline text-ink-muted transition hover:border-hairline-strong hover:text-ink xl:hidden"
        >
          <Burger open={open} />
        </button>
      </nav>

      <div
        id="nav-menu"
        hidden={!open}
        className="border-t border-hairline bg-page/95 backdrop-blur-xl xl:hidden"
      >
        <ul className="mx-auto grid w-full max-w-6xl gap-1 px-5 py-4 sm:px-8">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 text-[15px] text-ink-muted transition hover:bg-surface hover:text-ink"
              >
                {link.label}
                <span className="text-gold">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <ScrollProgress />
    </header>
  );
}

function Burger({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="transition-transform duration-300"
      >
        {open ? (
          <>
            <path d="m6 6 12 12" />
            <path d="M18 6 6 18" />
          </>
        ) : (
          <>
            <path d="M4 8h16" />
            <path d="M4 16h16" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Crescent inside a ring — the mark, drawn rather than set in type. */
function Sigil() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="size-7 text-gold transition-transform duration-700 group-hover:rotate-180"
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <path
        fill="currentColor"
        d="M20.4 6.2a10.6 10.6 0 0 0 0 19.6 10.6 10.6 0 1 1 0-19.6Z"
      />
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="2 6"
      />
    </svg>
  );
}
