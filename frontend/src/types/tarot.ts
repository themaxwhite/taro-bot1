/**
 * Frontend-facing description of a spread type. Card selection,
 * randomness and orientation are decided by the backend (Tarot Engine) —
 * this type only describes what the UI needs to render a choice.
 */
export type SpreadId = "daily-card" | "love" | "future";

export interface SpreadType {
  id: SpreadId;
  title: string;
  description: string;
  cardCount: number;
}

export const SPREAD_TYPES: SpreadType[] = [
  {
    id: "daily-card",
    title: "Карта дня",
    description: "Одна карта — подсказка на сегодня",
    cardCount: 1,
  },
  {
    id: "love",
    title: "Любовь",
    description: "Прошлое, настоящее, возможное развитие",
    cardCount: 3,
  },
  {
    id: "future",
    title: "Будущее",
    description: "Текущая ситуация, скрытый фактор, развитие",
    cardCount: 3,
  },
];
