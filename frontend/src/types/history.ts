import type { SpreadId } from "./tarot";
import type { DrawnCard } from "./result";

/**
 * A single completed spread as shown in the History screen.
 * Mirrors backend/app/history/schemas.py::HistoryEntry — card resolution
 * (name, orientation) happens on the backend, this type only describes
 * what the frontend needs to render a history item.
 */
export interface HistoryEntry {
  id: number;
  spreadId: SpreadId;
  spreadTitle: string;
  /** ISO 8601 date string */
  completedAt: string;
  cards: DrawnCard[];
  question: string | null;
  interpretation: string | null;
}

/** Mirrors backend/app/history/schemas.py::ProfileStats. */
export interface ProfileStats {
  totalSpreads: number;
  daysStreak: number;
}
