import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cardSrc, deck, type DeckCard } from "../deck";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { Eyebrow, Heading, Lead, OpenInTelegram, Section } from "./primitives";

type Draw = { card: DeckCard; reversed: boolean };

const drawFromDeck = (previousId?: string): Draw => {
  /* Avoid repeating the card the visitor is already looking at — one repeat in
     fifteen would read as the demo being broken rather than as chance. */
  const pool = previousId ? deck.filter((c) => c.id !== previousId) : deck;
  return {
    card: pool[Math.floor(Math.random() * pool.length)]!,
    reversed: Math.random() < 0.35,
  };
};

export function DrawCard() {
  const reduced = useReducedMotion();
  const [draw, setDraw] = useState<Draw | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pull = useCallback(() => {
    if (shuffling) return;
    const next = drawFromDeck(draw?.card.id);
    if (reduced) {
      setDraw(next);
      return;
    }
    setShuffling(true);
    setDraw(null);
    timer.current = window.setTimeout(() => {
      setDraw(next);
      setShuffling(false);
    }, 620);
  }, [draw, reduced, shuffling]);

  const flipped = draw !== null;

  return (
    <Section id="draw">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow>Попробовать</Eyebrow>
          <Heading>Вытяните карту прямо здесь</Heading>
          <Lead>
            Демонстрация на пятнадцати старших арканах: карта и её положение
            выбираются случайно, значения — те же, что в приложении. Полный
            расклад с вашим вопросом и толкованием — в Telegram.
          </Lead>

          <div
            aria-live="polite"
            className="panel mt-9 min-h-[132px] rounded-3xl p-7"
          >
            {draw ? (
              <>
                <p className="font-display text-2xl text-ink">
                  {draw.card.name}
                  <span className="ml-3 align-middle text-xs font-semibold tracking-[0.16em] text-gold-strong uppercase">
                    {draw.reversed ? "перевёрнута" : "прямое положение"}
                  </span>
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                  {draw.reversed ? draw.card.reversed : draw.card.upright}
                </p>
              </>
            ) : (
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {shuffling
                  ? "Колода тасуется…"
                  : "Колода перетасована. Нажмите на карту, чтобы её перевернуть."}
              </p>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={pull}
              disabled={shuffling}
              className="rounded-full border border-hairline px-6 py-3 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-50"
            >
              {flipped ? "Вытянуть ещё" : "Вытянуть карту"}
            </button>
            <OpenInTelegram>Полный расклад</OpenInTelegram>
          </div>
        </div>

        <div className="flex justify-center [perspective:1400px]">
          <button
            type="button"
            onClick={pull}
            aria-label={
              draw
                ? `Выпала карта ${draw.card.name}. Вытянуть ещё одну`
                : "Вытянуть карту"
            }
            className={`group relative aspect-[2/3] w-56 cursor-pointer rounded-2xl transition-transform duration-700 [transform-style:preserve-3d] focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-gold-strong sm:w-72 ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            } ${shuffling ? "shuffling" : ""}`}
          >
            <Face>
              <img
                src="/cards/card-back.webp"
                alt=""
                width={480}
                height={720}
                decoding="async"
                className="card-art size-full rounded-2xl object-cover"
              />
              <Sheen />
              <span className="absolute inset-x-0 -bottom-9 text-center text-xs tracking-[0.16em] text-ink-muted uppercase transition group-hover:text-gold-strong">
                нажмите, чтобы перевернуть
              </span>
            </Face>

            <Face className="[transform:rotateY(180deg)]">
              {draw && (
                <img
                  src={cardSrc(draw.card.id)}
                  alt={draw.card.name}
                  width={480}
                  height={720}
                  decoding="async"
                  className="card-art size-full rounded-2xl object-cover transition-transform duration-500"
                  style={{ rotate: draw.reversed ? "180deg" : undefined }}
                />
              )}
              <Sheen />
            </Face>
          </button>
        </div>
      </div>
    </Section>
  );
}

function Face({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`absolute inset-0 rounded-2xl border border-hairline bg-surface shadow-[0_36px_70px_-30px_#000] [backface-visibility:hidden] ${className}`}
    >
      {children}
    </span>
  );
}

/** Diagonal gold gloss that sweeps across the card on hover. */
function Sheen() {
  return (
    <span
      aria-hidden="true"
      className="sheen pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    />
  );
}
