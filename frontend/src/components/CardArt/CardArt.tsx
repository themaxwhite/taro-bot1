/**
 * Every one of the 78 cards gets its own emblem, but all emblems share
 * one visual language: a thin gold line drawn on a 100x100 grid, inside
 * the same circular medallion. This is generated art, not photography —
 * deliberately abstract/symbolic (a wheel for "Колесо Фортуны", a tower
 * silhouette for "Башня", etc.) so it stays consistent, license-free,
 * and legible at card-thumbnail size.
 *
 * Major Arcana (22): one hand-picked symbolic glyph per card, keyed by
 * its index (major-00..major-21).
 * Minor Arcana (56): a suit glyph (wand / cup / sword / pentacle) plus a
 * rank marker — pip dots for Ace..10, a small badge shape for the four
 * court cards — so every combination is still visually distinct.
 */
import type { ReactNode } from "react";
import type { Arcana } from "../../types/result";

const STROKE = "var(--color-accent)";

function Medallion({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="none" stroke={STROKE} strokeWidth="1.5" opacity="0.35" />
      <g fill="none" stroke={STROKE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

// --- Major Arcana: 22 hand-picked symbolic glyphs, index 0..21 ---
const MAJOR_GLYPHS: (() => ReactNode)[] = [
  () => (<><path d="M30 68 Q50 30 70 32" /><circle cx="70" cy="32" r="4" fill={STROKE} /></>), // 0 Шут — восходящий путь к звезде
  () => (<><path d="M50 20 A18 18 0 1 0 50.01 20" /><path d="M50 50 L50 78" /></>), // 1 Маг — бесконечность и жезл
  () => (<><path d="M38 25 L38 75" /><path d="M62 25 L62 75" /><path d="M42 50 A8 8 0 1 0 58 50" /></>), // 2 Жрица — колонны и завеса
  () => (<><circle cx="50" cy="50" r="6" fill={STROKE} />{[0, 60, 120, 180, 240, 300].map((a) => (
      <line key={a} x1="50" y1="50" x2={50 + 22 * Math.cos((a * Math.PI) / 180)} y2={50 + 22 * Math.sin((a * Math.PI) / 180)} />
    ))}</>), // 3 Императрица — цветок
  () => (<><rect x="34" y="42" width="32" height="30" /><path d="M40 42 Q40 26 50 30 Q60 26 60 42" /></>), // 4 Император — трон и рога
  () => (<><line x1="38" y1="24" x2="38" y2="76" /><line x1="62" y1="24" x2="62" y2="76" /><line x1="38" y1="38" x2="62" y2="38" /><line x1="38" y1="50" x2="62" y2="50" /></>), // 5 Иерофант — врата и ключи
  () => (<><circle cx="42" cy="48" r="16" /><circle cx="58" cy="48" r="16" /><path d="M50 24 L50 32" /></>), // 6 Влюблённые — союз
  () => (<><path d="M32 66 L38 40 L62 40 L68 66 Z" /><circle cx="40" cy="72" r="6" /><circle cx="60" cy="72" r="6" /></>), // 7 Колесница
  () => (<><path d="M28 60 Q50 74 72 60" /><path d="M40 34 A10 10 0 1 0 40.01 34" /></>), // 8 Сила — бесконечность над дугой
  () => (<><polygon points="50,26 62,34 62,50 50,58 38,50 38,34" /><circle cx="50" cy="42" r="4" fill={STROKE} /><line x1="66" y1="30" x2="66" y2="70" /></>), // 9 Отшельник — фонарь и посох
  () => (<><circle cx="50" cy="50" r="24" />{[0, 60, 120, 180, 240, 300].map((a) => (
      <line key={a} x1={50 + 10 * Math.cos((a * Math.PI) / 180)} y1={50 + 10 * Math.sin((a * Math.PI) / 180)} x2={50 + 24 * Math.cos((a * Math.PI) / 180)} y2={50 + 24 * Math.sin((a * Math.PI) / 180)} />
    ))}</>), // 10 Колесо Фортуны
  () => (<><line x1="50" y1="26" x2="50" y2="66" /><line x1="30" y1="40" x2="70" y2="40" /><circle cx="30" cy="50" r="7" /><circle cx="70" cy="50" r="7" /><line x1="42" y1="74" x2="58" y2="74" /></>), // 11 Справедливость — весы
  () => (<><line x1="30" y1="30" x2="70" y2="30" /><path d="M50 30 L36 62 L64 62 Z" /><circle cx="50" cy="70" r="5" /></>), // 12 Повешенный
  () => (<><path d="M50 24 L66 50 L50 76 L34 50 Z" /></>), // 13 Смерть — песочные часы/переход
  () => (<><path d="M32 58 Q40 44 48 58 Q56 72 64 58" /><path d="M36 40 L44 24 L52 40" /><path d="M52 40 L60 24 L68 40" /></>), // 14 Умеренность — переливающиеся чаши
  () => (<><polygon points="50,28 68,62 32,62" /><path d="M40 30 L44 22" /><path d="M60 30 L56 22" /></>), // 15 Дьявол — перевёрнутый треугольник и рожки
  () => (<><rect x="42" y="30" width="16" height="44" /><path d="M30 30 L46 48 L38 48 L54 68" /></>), // 16 Башня — молния
  () => (<>{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <line key={a} x1={50 + 10 * Math.cos((a * Math.PI) / 180)} y1={50 + 10 * Math.sin((a * Math.PI) / 180)} x2={50 + 26 * Math.cos((a * Math.PI) / 180)} y2={50 + 26 * Math.sin((a * Math.PI) / 180)} />
    ))}</>), // 17 Звезда
  () => (<><path d="M58 30 A20 20 0 1 0 58 70 A16 16 0 1 1 58 30" /><path d="M30 68 Q50 62 70 68" /></>), // 18 Луна — полумесяц и вода
  () => (<><circle cx="50" cy="50" r="14" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <line key={a} x1={50 + 18 * Math.cos((a * Math.PI) / 180)} y1={50 + 18 * Math.sin((a * Math.PI) / 180)} x2={50 + 28 * Math.cos((a * Math.PI) / 180)} y2={50 + 28 * Math.sin((a * Math.PI) / 180)} />
    ))}</>), // 19 Солнце
  () => (<><path d="M50 66 L38 34 Q50 26 62 34 Z" /><line x1="30" y1="30" x2="36" y2="36" /><line x1="70" y1="30" x2="64" y2="36" /></>), // 20 Суд — труба и лучи
  () => (<><ellipse cx="50" cy="50" rx="26" ry="20" /><polygon points="50,38 55,50 50,62 45,50" /></>), // 21 Мир — венок и звезда
];

// --- Minor Arcana: suit glyph + rank marker ---
function SuitGlyph({ suit }: { suit: string }) {
  switch (suit) {
    case "wands":
      return (<><line x1="34" y1="70" x2="66" y2="30" /><line x1="44" y1="46" x2="36" y2="42" /><line x1="52" y1="38" x2="44" y2="34" /></>);
    case "cups":
      return (<><path d="M36 32 Q36 54 50 54 Q64 54 64 32 Z" /><line x1="50" y1="54" x2="50" y2="66" /><line x1="38" y1="70" x2="62" y2="70" /></>);
    case "swords":
      return (<><line x1="50" y1="24" x2="50" y2="66" /><line x1="38" y1="38" x2="62" y2="38" /><path d="M42 66 L58 66 L50 76 Z" /></>);
    case "pentacles":
    default:
      return (<><circle cx="50" cy="50" r="24" /><polygon points="50,32 56,46 71,46 59,55 63,70 50,61 37,70 41,55 29,46 44,46" /></>);
  }
}

function RankMarker({ rankId }: { rankId: string }) {
  const courtBadge: Record<string, ReactNode> = {
    page: <circle cx="50" cy="15" r="5" fill={STROKE} />,
    knight: <polygon points="50,7 57,18 43,18" fill={STROKE} />,
    queen: <path d="M43 22 Q50 4 57 22 Q50 15 43 22 Z" fill={STROKE} />,
    king: <><line x1="42" y1="20" x2="42" y2="8" /><line x1="50" y1="20" x2="50" y2="4" /><line x1="58" y1="20" x2="58" y2="8" /><line x1="42" y1="20" x2="58" y2="20" /></>,
  };
  if (rankId in courtBadge) return <g stroke={STROKE} strokeWidth="3">{courtBadge[rankId]}</g>;

  const pipCount = rankId === "ace" ? 1 : parseInt(rankId, 10);
  const perRow = pipCount > 5 ? Math.ceil(pipCount / 2) : pipCount;
  const dots = Array.from({ length: pipCount }, (_, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = row === Math.floor((pipCount - 1) / perRow) ? pipCount - row * perRow : perRow;
    const x = 50 - ((rowCount - 1) * 6) / 2 + col * 6;
    const y = 14 + row * 6;
    return <circle key={i} cx={x} cy={y} r="1.6" fill={STROKE} />;
  });
  return <>{dots}</>;
}

interface CardArtProps {
  cardId: string;
  arcana: Arcana;
}

export function CardArt({ cardId, arcana }: CardArtProps) {
  if (arcana === "major") {
    const index = parseInt(cardId.replace("major-", ""), 10);
    const Glyph = MAJOR_GLYPHS[index] ?? MAJOR_GLYPHS[0];
    return <Medallion>{Glyph()}</Medallion>;
  }

  // minor-<suit>-<rank>
  const [, suit, rankId] = cardId.split("-");
  return (
    <Medallion>
      <SuitGlyph suit={suit} />
      <RankMarker rankId={rankId} />
    </Medallion>
  );
}
