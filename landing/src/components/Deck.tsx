import { site } from "../site";
import { Reveal, Section, SectionIntro } from "./primitives";

const showcase = [
  { src: "/cards/major-00.webp", alt: "Шут" },
  { src: "/cards/major-01.webp", alt: "Маг" },
  { src: "/cards/major-06.webp", alt: "Влюблённые" },
  { src: "/cards/major-10.webp", alt: "Колесо Фортуны" },
  { src: "/cards/major-17.webp", alt: "Звезда" },
  { src: "/cards/major-21.webp", alt: "Мир" },
];

export function Deck() {
  return (
    <Section id="deck">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <SectionIntro
            eyebrow="Колода"
            title={`Taro Aurum — все ${site.deckSize} карт нарисованы`}
          >
            Старшие и младшие арканы в едином стиле: тёплый пергамент, бронзовая
            линия и приглушённый шалфейный акцент. Ни одной карты-заглушки и ни
            одного стокового изображения.
          </SectionIntro>

          <Reveal delay={160}>
            <ul className="mt-8 space-y-3 text-[15px] text-ink-muted">
              {[
                "22 старших аркана и 56 младших",
                "Прямое и перевёрнутое положение читаются отдельно",
                "Своя рубашка — колода выглядит как колода, а не как список",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="grid grid-cols-3 gap-3 [perspective:1000px] sm:gap-5">
          {showcase.map((card, i) => (
            <Reveal key={card.src} index={i} step={70}>
              <figure className="group">
                <img
                  src={card.src}
                  alt={card.alt}
                  width={480}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className="card-art w-full rounded-2xl border border-hairline shadow-[0_22px_44px_-24px_#000] transition duration-500 group-hover:-translate-y-2.5 group-hover:shadow-[0_36px_60px_-28px_var(--gold-strong)] group-hover:[transform:translateY(-10px)_rotateX(8deg)_rotateY(-6deg)]"
                  style={{ rotate: `${(i % 2 === 0 ? -1 : 1) * 1.5}deg` }}
                />
                <figcaption className="mt-2.5 text-center text-xs text-ink-muted transition group-hover:text-gold-strong">
                  {card.alt}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
