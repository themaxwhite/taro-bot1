/**
 * Frontend-facing description of a subscription tier. Pricing and quota
 * are decided by the backend (app/subscriptions.py) — this type only
 * describes what the UI needs to render a choice. Keep in sync with that
 * file: same tier ids, prices, quotas, descriptions and badges.
 */
export type SubscriptionTierId = "basic" | "plus" | "premium";

export interface TierOption {
  id: SubscriptionTierId;
  title: string;
  priceRub: number;
  monthlyQuota: number;
  description: string;
  badge: string | null;
}

export const TIERS: TierOption[] = [
  {
    id: "basic",
    title: "Базовый",
    priceRub: 199,
    monthlyQuota: 10,
    description:
      "10 разблокировок в месяц — подробное толкование расклада, дополнительная карта или уточняющий вопрос. Хороший старт, если гадаете время от времени и хотите более глубокий ответ, когда он действительно нужен.",
    badge: null,
  },
  {
    id: "plus",
    title: "Плюс",
    priceRub: 399,
    monthlyQuota: 30,
    description:
      "30 разблокировок в месяц — хватит почти на каждый день. Самый популярный тариф среди тех, кто уже не представляет расклад без подробного толкования.",
    badge: "Популярный",
  },
  {
    id: "premium",
    title: "Премиум",
    priceRub: 799,
    monthlyQuota: 100,
    description:
      "100 разблокировок в месяц и эксклюзив: свой вопрос к раскладу своими словами, а не только из готового списка. Для тех, кому нужен настоящий разговор с картами, а не шаблонные ответы.",
    badge: "Максимум",
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
  /** Free daily energy (see backend require_quota) still unspent today. */
  energyAvailable: boolean;
}
