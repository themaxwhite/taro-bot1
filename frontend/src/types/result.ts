import type { SpreadId } from "./tarot";

export type Arcana = "major" | "minor";

/**
 * Mirrors backend/app/tarot/schemas.py::DrawnCard.
 * Card identity, arcana and orientation are decided exclusively by the
 * backend Tarot Engine — this type just describes the response shape.
 */
export interface DrawnCard {
  position: number;
  position_label: string;
  card_id: string;
  name: string;
  arcana: Arcana;
  is_reversed: boolean;
  meaning: string;
}

/** Mirrors backend/app/tarot/schemas.py::DrawSpreadResponse. */
export interface DrawSpreadResponse {
  id: number;
  spread_id: SpreadId;
  /** Пусто, пока `unlocked` false — backend не отдаёт карты неоплаченного расклада. */
  cards: DrawnCard[];
  /** Оплачен ли расклад. False — рисуем `card_count` рубашек. */
  unlocked: boolean;
  /** Сколько карт в раскладе; известно и до оплаты, чтобы верстка не прыгала. */
  card_count: number;
  /** ISO 8601 date string, only set for spread_id === "daily-card". */
  next_available_at: string | null;
  /** Энергия, начисленная за серию дней подряд, если этот расклад довёл её до порога. */
  streak_bonus: number | null;
}
