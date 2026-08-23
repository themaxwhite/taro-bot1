import type { HistoryEntry, ProfileStats } from "../types/history";
import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Raw wire shapes — the backend (FastAPI/pydantic) returns snake_case
// field names as-is; these interfaces describe that JSON before it gets
// mapped into the camelCase types the rest of the frontend uses.
interface HistoryEntryDTO {
  id: number;
  spread_id: HistoryEntry["spreadId"];
  spread_title: string;
  completed_at: string;
  cards: HistoryEntry["cards"];
  question: string | null;
  interpretation: string | null;
}

interface ProfileStatsDTO {
  total_spreads: number;
  days_streak: number;
}

async function authedFetch(path: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }

  if (response.status === 401) {
    throw new SpreadsApiError("Не удалось подтвердить пользователя Telegram.");
  }
  if (!response.ok) {
    throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  }
  return response;
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const response = await authedFetch("/api/history");
  const data = (await response.json()) as HistoryEntryDTO[];
  return data.map((entry) => ({
    id: entry.id,
    spreadId: entry.spread_id,
    spreadTitle: entry.spread_title,
    completedAt: entry.completed_at,
    cards: entry.cards,
    question: entry.question,
    interpretation: entry.interpretation,
  }));
}

export async function fetchProfileStats(): Promise<ProfileStats> {
  const response = await authedFetch("/api/profile/stats");
  const data = (await response.json()) as ProfileStatsDTO;
  return { totalSpreads: data.total_spreads, daysStreak: data.days_streak };
}

interface ProfileDTO {
  first_name: string;
  username: string | null;
  interests: string | null;
  notifications_enabled: boolean;
}

export interface Profile {
  interests: string;
  notificationsEnabled: boolean;
}

export async function fetchProfile(): Promise<Profile> {
  const response = await authedFetch("/api/profile");
  const data = (await response.json()) as ProfileDTO;
  return { interests: data.interests ?? "", notificationsEnabled: data.notifications_enabled };
}

async function authedPatch(path: string, body: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }
  if (!response.ok) {
    throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  }
}

export async function updateInterests(interests: string): Promise<void> {
  await authedPatch("/api/profile/interests", { interests });
}

export async function updateNotifications(enabled: boolean): Promise<void> {
  await authedPatch("/api/profile/notifications", { enabled });
}
