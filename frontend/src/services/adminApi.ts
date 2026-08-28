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
