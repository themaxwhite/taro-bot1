/**
 * Frontend-facing description of a subscription tier. Pricing and quota
 * are decided by the backend (app/subscriptions.py) — this type only
 * describes what the UI needs to render a choice. Keep in sync with that
 * file: same tier ids, prices and quotas.
 */
export type SubscriptionTierId = "basic" | "plus";

export interface TierOption {
  id: SubscriptionTierId;
  title: string;
  priceRub: number;
  monthlyQuota: number;
  description: string;
}

export const TIERS: TierOption[] = [
  {
    id: "basic",
    title: "Базовый",
    priceRub: 199,
    monthlyQuota: 10,
    description: "10 разблокировок в месяц — подробное толкование расклада или дополнительная карта",
  },
  {
    id: "plus",
    title: "Плюс",
    priceRub: 399,
    monthlyQuota: 30,
    description: "30 разблокировок в месяц — для тех, кто гадает часто",
  },
];

/**
 * Mirrors backend/app/api/subscriptions.py::SubscriptionStatusResponse.
 * `tier` is a plain string, not `SubscriptionTierId` — it can also be
 * "admin" (see ADMIN_PROMO_CODE), which isn't one of the purchasable
 * tiers shown in the picker.
 */
export interface SubscriptionStatus {
  tier: string | null;
  status: "active" | "expired" | null;
  quotaTotal: number | null;
  quotaUsed: number | null;
  /** ISO 8601 date string */
  periodEnd: string | null;
}
