import type { SpreadId } from "./tarot";
import type { DrawnCard } from "./result";

/**
 * A single completed spread as shown in the History screen.
 * Mirrors backend/app/history/schemas.py::HistoryEntry — card resolution
 * (name, orientation) happens on the backend, this type only describes
 * what the frontend needs to render a history item.
 */
export interface HistoryFollowUp {
  questionKey: string;
  questionLabel: string;
  answer: string;
}

export interface HistoryEntry {
  id: number;
  spreadId: SpreadId;
  spreadTitle: string;
  /** ISO 8601 date string */
  completedAt: string;
  /** Пусто для неразблокированного расклада — backend их не отдаёт. */
  cards: DrawnCard[];
  unlocked: boolean;
  cardCount: number;
  question: string | null;
  interpretation: string | null;
  followUps: HistoryFollowUp[];
}

/** Mirrors backend/app/history/schemas.py::ProfileStats. */
export interface ProfileStats {
  totalSpreads: number;
  daysStreak: number;
  /** Ближайший непройденный порог серии и его награда; null — все пройдены. */
  nextRewardDay: number | null;
  nextRewardEnergy: number | null;
}

/** Mirrors backend/app/history/schemas.py::ProfileInsights. */
export interface ActivityDay {
  date: string;
  count: number;
}

export interface TopCard {
  cardId: string;
  name: string;
  count: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  glyph: string;
  unlocked: boolean;
}

export interface ProfileInsights {
  /** Только дни, в которые расклады были — сетку достраиваем сами. */
  activity: ActivityDay[];
  activityFrom: string;
  activityTo: string;
  topCards: TopCard[];
  totalCards: number;
  reversedShare: number;
  majorShare: number;
  favoriteSpread: string | null;
  favoriteSpreadCount: number;
  achievements: Achievement[];
}
