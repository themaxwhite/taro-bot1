import type { EnergyBreakdown } from "./energy";

/**
 * Тариф в том виде, в каком его отдаёт backend
 * (GET /api/subscriptions/tiers). Раньше этот список был захардкожен
 * здесь и его требовалось держать синхронно с app/subscriptions.py —
 * теперь витрину отдаёт сервер, чтобы цена на экране и цена в счёте не
 * могли разойтись.
 */
export type SubscriptionTierId = "basic" | "plus" | "premium" | "master";

export interface TierOption {
  id: SubscriptionTierId;
  title: string;
  priceRub: number;
  monthlyQuota: number;
  description: string;
  badge: string | null;
  /** Что входит помимо количества — по существу, а не размером пакета. */
  perks: string[];
}

/**
 * Названия тарифов для отображения уже оформленной подписки. Сюда
 * входит и снятый с продажи «Базовый», которого нет в витрине с
 * сервера: у него могут оставаться действующие подписчики, и профиль
 * обязан назвать их тариф, а не показать сырой идентификатор.
 */
export const TIER_TITLES: Record<string, string> = {
  basic: "Базовый",
  plus: "Плюс",
  premium: "Премиум",
  master: "Магистр",
  admin: "Админ-доступ",
};

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
  /** Есть ли хоть одна разблокировка прямо сейчас, из любого источника. */
  energyAvailable: boolean;
  /** Единый баланс и его состав — см. types/energy.ts. */
  energy: EnergyBreakdown;
  /** Ссылка на личный чат поддержки; null, если тариф её не даёт. */
  supportChatUrl: string | null;
}
