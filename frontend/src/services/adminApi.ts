import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface AdminStatsDTO {
  users_total: number;
  users_new_today: number;
  users_new_7d: number;
  active_today: number;
  spreads_total: number;
  spreads_today: number;
  active_subscriptions: Record<string, number>;
  revenue_total_rub: number;
  revenue_7d_rub: number;
  referrals_total: number;
}

export interface AdminStats {
  usersTotal: number;
  usersNewToday: number;
  usersNew7d: number;
  activeToday: number;
  spreadsTotal: number;
  spreadsToday: number;
  /**
   * Активные подписки по тарифам: id тарифа -> количество. Словарём, а
   * не полем на тариф, — тарифы добавляются и снимаются с продажи, и
   * фиксированные поля пришлось бы править здесь при каждом изменении.
   */
  activeSubscriptions: Record<string, number>;
  revenueTotalRub: number;
  revenue7dRub: number;
  referralsTotal: number;
}

function toAdminStats(data: AdminStatsDTO): AdminStats {
  return {
    usersTotal: data.users_total,
    usersNewToday: data.users_new_today,
    usersNew7d: data.users_new_7d,
    activeToday: data.active_today,
    spreadsTotal: data.spreads_total,
    spreadsToday: data.spreads_today,
    activeSubscriptions: data.active_subscriptions,
    revenueTotalRub: data.revenue_total_rub,
    revenue7dRub: data.revenue_7d_rub,
    referralsTotal: data.referrals_total,
  };
}

export async function fetchAdminStats(): Promise<AdminStats> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
      headers: {
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }

  if (response.status === 403) {
    throw new SpreadsApiError("Нет доступа к дашборду.");
  }
  if (!response.ok) {
    throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  }
  return toAdminStats((await response.json()) as AdminStatsDTO);
}

export interface AdminUserBrief {
  telegramId: number;
  firstName: string;
  username: string | null;
  createdAt: string;
  spreadsTotal: number;
}

export interface AdminPayment {
  /** Наш id платежа, он же номер заказа в платёжке. */
  id: number;
  createdAt: string;
  kind: string;
  tier: string;
  energyAmount: number;
  amountRub: number;
  status: string;
  /** Какая платёжка провела платёж. У всех имеющихся — "yookassa". */
  provider: string;
  /**
   * Id платежа на стороне платёжки. Null у платежа, не доведённого до
   * конца: свой номер платёжка присваивает только вместе с оплатой.
   */
  providerPaymentId: string | null;
}

export interface AdminEvent {
  createdAt: string;
  kind: string;
  title: string;
  cost: number;
  detail: string | null;
}

export interface AdminUserDetail {
  telegramId: number;
  firstName: string;
  username: string | null;
  createdAt: string;
  zodiacSign: string | null;
  patronCard: string | null;
  referredBy: number | null;
  referralsCount: number;
  energyDaily: number;
  energyRefreshedDate: string | null;
  energyPurchased: number;
  energyReferral: number;
  energyTotal: number;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  subscriptionQuotaTotal: number | null;
  subscriptionQuotaUsed: number | null;
  subscriptionPeriodEnd: string | null;
  spreadsTotal: number;
  chatQuestions: number;
  payments: AdminPayment[];
  events: AdminEvent[];
}

async function adminFetch(path: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "" },
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }
  if (response.status === 403) throw new SpreadsApiError("Нет доступа к дашборду.");
  if (response.status === 404) throw new SpreadsApiError("Пользователь не найден.");
  if (!response.ok) throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  return response;
}

export async function searchAdminUsers(query: string): Promise<AdminUserBrief[]> {
  const response = await adminFetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as {
    telegram_id: number;
    first_name: string;
    username: string | null;
    created_at: string;
    spreads_total: number;
  }[];
  return data.map((u) => ({
    telegramId: u.telegram_id,
    firstName: u.first_name,
    username: u.username,
    createdAt: u.created_at,
    spreadsTotal: u.spreads_total,
  }));
}

export async function fetchAdminUser(telegramId: number): Promise<AdminUserDetail> {
  const response = await adminFetch(`/api/admin/users/${telegramId}`);
  const d = (await response.json()) as Record<string, never> & {
    [k: string]: unknown;
  };
  const payments = (d.payments as Record<string, unknown>[]).map((p) => ({
    id: p.id as number,
    createdAt: p.created_at as string,
    kind: p.kind as string,
    tier: p.tier as string,
    energyAmount: p.energy_amount as number,
    amountRub: p.amount_rub as number,
    status: p.status as string,
    provider: p.provider as string,
    providerPaymentId: (p.provider_payment_id as string | null) ?? null,
  }));
  const events = (d.events as Record<string, unknown>[]).map((e) => ({
    createdAt: e.created_at as string,
    kind: e.kind as string,
    title: e.title as string,
    cost: e.cost as number,
    detail: (e.detail as string | null) ?? null,
  }));
  return {
    telegramId: d.telegram_id as number,
    firstName: d.first_name as string,
    username: (d.username as string | null) ?? null,
    createdAt: d.created_at as string,
    zodiacSign: (d.zodiac_sign as string | null) ?? null,
    patronCard: (d.patron_card as string | null) ?? null,
    referredBy: (d.referred_by as number | null) ?? null,
    referralsCount: d.referrals_count as number,
    energyDaily: d.energy_daily as number,
    energyRefreshedDate: (d.energy_refreshed_date as string | null) ?? null,
    energyPurchased: d.energy_purchased as number,
    energyReferral: d.energy_referral as number,
    energyTotal: d.energy_total as number,
    subscriptionTier: (d.subscription_tier as string | null) ?? null,
    subscriptionStatus: (d.subscription_status as string | null) ?? null,
    subscriptionQuotaTotal: (d.subscription_quota_total as number | null) ?? null,
    subscriptionQuotaUsed: (d.subscription_quota_used as number | null) ?? null,
    subscriptionPeriodEnd: (d.subscription_period_end as string | null) ?? null,
    spreadsTotal: d.spreads_total as number,
    chatQuestions: d.chat_questions as number,
    payments,
    events,
  };
}
