import type { EnergyPack } from "../types/energy";
import type { SubscriptionStatus, SubscriptionTierId, TierOption } from "../types/subscription";
import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function api(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
        ...init?.headers,
      },
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }
  if (response.status === 401) {
    throw new SpreadsApiError("Не удалось подтвердить пользователя Telegram.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new SpreadsApiError(body?.detail ?? `Сервер вернул ошибку (${response.status}).`);
  }
  return response;
}

interface StatusResponseBody {
  tier: string | null;
  status: "active" | "expired" | null;
  quota_total: number | null;
  quota_used: number | null;
  period_end: string | null;
  energy_available: boolean;
  energy_balance: number;
  energy_daily: number;
  energy_daily_max: number;
  energy_purchased: number;
  energy_referral: number;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await api("/api/subscriptions/status");
  const data = (await response.json()) as StatusResponseBody;
  return {
    tier: data.tier,
    status: data.status,
    quotaTotal: data.quota_total,
    quotaUsed: data.quota_used,
    periodEnd: data.period_end,
    energyAvailable: data.energy_available,
    energy: {
      balance: data.energy_balance,
      daily: data.energy_daily,
      dailyMax: data.energy_daily_max,
      purchased: data.energy_purchased,
      referral: data.energy_referral,
      subscription:
        data.status === "active" && data.quota_total !== null
          ? {
              remaining: Math.max(data.quota_total - (data.quota_used ?? 0), 0),
              total: data.quota_total,
            }
          : null,
    },
  };
}

/** Витрина тарифов. Снятые с продажи сюда не попадают. */
export async function getTiers(): Promise<TierOption[]> {
  const response = await api("/api/subscriptions/tiers");
  const data = (await response.json()) as {
    id: SubscriptionTierId;
    title: string;
    price_rub: number;
    monthly_quota: number;
    description: string;
    badge: string | null;
    perks: string[];
  }[];
  return data.map((t) => ({
    id: t.id,
    title: t.title,
    priceRub: t.price_rub,
    monthlyQuota: t.monthly_quota,
    description: t.description,
    badge: t.badge,
    perks: t.perks,
  }));
}

export async function getEnergyPacks(): Promise<EnergyPack[]> {
  const response = await api("/api/subscriptions/energy-packs");
  const data = (await response.json()) as {
    id: string;
    title: string;
    amount: number;
    price_rub: number;
    badge: string | null;
  }[];
  return data.map((p) => ({
    id: p.id,
    title: p.title,
    amount: p.amount,
    priceRub: p.price_rub,
    badge: p.badge,
  }));
}

export async function redeemPromoCode(code: string): Promise<void> {
  await api("/api/subscriptions/redeem-promo", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

/**
 * Заводит платёж и возвращает адрес формы оплаты Робокассы.
 *
 * Ссылку строит сервер: в неё входит подпись, а ключ, которым она
 * считается, в браузере оказаться не должен ни при каких условиях.
 */
export async function createPayment(
  kind: "energy" | "subscription",
  itemId: string,
): Promise<string> {
  const response = await api("/api/payments/robokassa/create", {
    method: "POST",
    body: JSON.stringify({ kind, item_id: itemId }),
  });
  const data = (await response.json()) as { payment_url: string; invoice_id: number };
  return data.payment_url;
}
