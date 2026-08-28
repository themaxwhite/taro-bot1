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
  energy_purchased: number;
  energy_referral: number;
  support_chat_url: string | null;
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
      purchased: data.energy_purchased,
      referral: data.energy_referral,
    },
    supportChatUrl: data.support_chat_url,
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

/**
 * Покупка пакета энергии. Тот же путь, что и подписка: ссылка на оплату
 * открывается в системном браузере, а возврат в Telegram не считается
 * доказательством оплаты — ждём, пока вебхук увеличит баланс.
 */
export async function buyEnergyPack(packId: string): Promise<void> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    throw new SpreadsApiError("Оплата доступна только внутри Telegram.");
  }

  const before = (await getSubscriptionStatus()).energy.purchased;

  const response = await api("/api/subscriptions/create-energy-payment", {
    method: "POST",
    body: JSON.stringify({ pack_id: packId }),
  });
  const { confirmation_url: confirmationUrl } = (await response.json()) as {
    confirmation_url: string;
  };
  webApp.openLink(confirmationUrl, { try_instant_view: false });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await getSubscriptionStatus();
    if (status.energy.purchased > before) return;
  }
  throw new SpreadsApiError(
    "Не удалось подтвердить оплату автоматически. Если деньги списались, откройте профиль ещё раз через минуту.",
  );
}

export async function redeemPromoCode(code: string): Promise<void> {
  await api("/api/subscriptions/redeem-promo", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function createSubscriptionPayment(
  tier: SubscriptionTierId,
): Promise<{ confirmationUrl: string; paymentId: string }> {
  const response = await api("/api/subscriptions/create-payment", {
    method: "POST",
    body: JSON.stringify({ tier }),
  });
  const data = (await response.json()) as { confirmation_url: string; payment_id: string };
  return { confirmationUrl: data.confirmation_url, paymentId: data.payment_id };
}

/**
 * Opens the ЮKassa payment page in the system browser (Telegram Mini Apps
 * can't embed an external checkout the way `openInvoice` embeds Stars)
 * and polls subscription status until it becomes active — the redirect
 * back into Telegram after paying isn't itself proof of payment, the
 * webhook flipping the subscription to "active" is the source of truth.
 */
export async function subscribeToTier(tier: SubscriptionTierId): Promise<void> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    throw new SpreadsApiError("Оплата доступна только внутри Telegram.");
  }

  const { confirmationUrl } = await createSubscriptionPayment(tier);
  webApp.openLink(confirmationUrl, { try_instant_view: false });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await getSubscriptionStatus();
    if (status.status === "active" && status.tier === tier) return;
  }
  throw new SpreadsApiError(
    "Не удалось подтвердить оплату автоматически. Если деньги списались, откройте профиль ещё раз через минуту.",
  );
}
