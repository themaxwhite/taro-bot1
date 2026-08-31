/**
 * Обращения к админским эндпойнтам бэкенда.
 *
 * Типы повторяют модели из backend/app/api/admin.py. Держать их
 * синхронными приходится вручную: у панели с бэкендом нет общей схемы, и
 * при изменении ответа сервера правится оба места.
 */

import { API_BASE, clearSession, type AdminSession } from "./auth";

export type Stats = {
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
  energy_sold_total: number;
  energy_unspent: number;
};

export type UserBrief = {
  telegram_id: number;
  first_name: string;
  username: string | null;
  created_at: string;
  spreads_total: number;
};

export type Payment = {
  id: number;
  created_at: string;
  kind: string;
  tier: string;
  energy_amount: number;
  amount_rub: number;
  status: string;
  provider: string;
  provider_payment_id: string | null;
};

export type UserEvent = {
  created_at: string;
  kind: string;
  title: string;
  cost: number;
  detail: string | null;
};

export type UserDetail = {
  telegram_id: number;
  first_name: string;
  username: string | null;
  created_at: string;
  gender: string | null;
  zodiac_sign: string | null;
  patron_card: string | null;
  notifications_enabled: boolean;
  referred_by: number | null;
  referrals_count: number;

  energy_daily: number;
  energy_refreshed_date: string | null;
  energy_purchased: number;
  energy_referral: number;
  energy_total: number;

  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_quota_total: number | null;
  subscription_quota_used: number | null;
  subscription_period_end: string | null;

  spreads_total: number;
  chat_questions: number;
  payments: Payment[];
  events: UserEvent[];
};

/** Ошибка с кодом ответа — по нему экран решает, что показать человеку. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, session: AdminSession): Promise<T> {
  const response = await fetch(API_BASE + path, {
    headers: { "X-Admin-Session": session.token },
  });

  if (response.status === 401) {
    // Пропуск протух или подпись не сошлась — хранить его дальше незачем.
    clearSession();
    throw new ApiError(401, "Вход устарел, войдите заново");
  }
  if (response.status === 403) {
    throw new ApiError(403, "Этот аккаунт Telegram не в списке администраторов");
  }
  if (!response.ok) {
    throw new ApiError(response.status, `Сервер ответил ${response.status}`);
  }

  return (await response.json()) as T;
}

export type DayStats = {
  date: string;
  new_users: number;
  active_users: number;
  spreads: number;
  revenue_rub: number;
  energy_sold: number;
};

export const getStats = (session: AdminSession) => request<Stats>("/api/admin/stats", session);

export const getTimeseries = (session: AdminSession, days = 30) =>
  request<DayStats[]>(`/api/admin/timeseries?days=${days}`, session);

export type PaymentRow = {
  id: number;
  created_at: string;
  user_id: number;
  user_name: string;
  username: string | null;
  kind: string;
  tier: string;
  energy_amount: number;
  amount_rub: number;
  status: string;
  provider: string;
  provider_payment_id: string | null;
};

export type PaymentsPage = {
  rows: PaymentRow[];
  total_count: number;
  succeeded_rub: number;
  pending_count: number;
};

export type SpreadRow = {
  spread_id: string;
  title: string;
  total: number;
  unlocked: number;
  users: number;
};

export type SpreadsBreakdown = {
  rows: SpreadRow[];
  total: number;
  unlocked_total: number;
  follow_ups: number;
  chat_questions: number;
};

export const getSpreads = (session: AdminSession, days = 30) =>
  request<SpreadsBreakdown>(`/api/admin/spreads?days=${days}`, session);

export const listPayments = (
  session: AdminSession,
  filters: { days: number; status: string; kind: string },
) => {
  const query = new URLSearchParams({
    days: String(filters.days),
    status: filters.status,
    kind: filters.kind,
  });
  return request<PaymentsPage>(`/api/admin/payments?${query}`, session);
};

export const searchUsers = (session: AdminSession, query: string) =>
  request<UserBrief[]>(`/api/admin/users?q=${encodeURIComponent(query)}`, session);

export const getUser = (session: AdminSession, id: number) =>
  request<UserDetail>(`/api/admin/users/${id}`, session);
