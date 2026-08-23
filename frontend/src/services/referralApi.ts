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
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new SpreadsApiError(body?.detail ?? `Сервер вернул ошибку (${response.status}).`);
  }
  return response;
}

export interface ReferralStatus {
  referralLink: string | null;
  referredCount: number;
  bonusQuota: number;
}

export async function registerReferral(referrerId: number): Promise<void> {
  await api("/api/referral/register", {
    method: "POST",
    body: JSON.stringify({ referrer_id: referrerId }),
  });
}

export async function getReferralStatus(): Promise<ReferralStatus> {
  const response = await api("/api/referral/status");
  const data = (await response.json()) as {
    referral_link: string | null;
    referred_count: number;
    bonus_quota: number;
  };
  return { referralLink: data.referral_link, referredCount: data.referred_count, bonusQuota: data.bonus_quota };
}
