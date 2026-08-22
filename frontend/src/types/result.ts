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
  cards: DrawnCard[];
}
