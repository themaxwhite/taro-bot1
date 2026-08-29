import type { HistoryEntry, ProfileStats } from "../types/history";
import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Raw wire shapes — the backend (FastAPI/pydantic) returns snake_case
// field names as-is; these interfaces describe that JSON before it gets
// mapped into the camelCase types the rest of the frontend uses.
interface FollowUpDTO {
  question_key: string;
  question_label: string;
  answer: string;
}

interface HistoryEntryDTO {
  id: number;
  spread_id: HistoryEntry["spreadId"];
  spread_title: string;
  completed_at: string;
  cards: HistoryEntry["cards"];
  unlocked: boolean;
  card_count: number;
  question: string | null;
  interpretation: string | null;
  follow_ups: FollowUpDTO[];
}

interface ProfileStatsDTO {
  total_spreads: number;
  days_streak: number;
  next_reward_day: number | null;
  next_reward_energy: number | null;
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
    unlocked: entry.unlocked,
    cardCount: entry.card_count,
    question: entry.question,
    interpretation: entry.interpretation,
    followUps: entry.follow_ups.map((fu) => ({
      questionKey: fu.question_key,
      questionLabel: fu.question_label,
      answer: fu.answer,
    })),
  }));
}

export async function fetchProfileStats(): Promise<ProfileStats> {
  const response = await authedFetch("/api/profile/stats");
  const data = (await response.json()) as ProfileStatsDTO;
  return {
    totalSpreads: data.total_spreads,
    daysStreak: data.days_streak,
    nextRewardDay: data.next_reward_day,
    nextRewardEnergy: data.next_reward_energy,
  };
}

export type Gender = "male" | "female";
export type ZodiacSign =
  | "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo"
  | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";

interface ProfileDTO {
  first_name: string;
  username: string | null;
  interests: string | null;
  notifications_enabled: boolean;
  gender: Gender | null;
  zodiac_sign: ZodiacSign | null;
  patron_card: string | null;
  is_admin: boolean;
}

export interface Profile {
  interests: string;
  notificationsEnabled: boolean;
  gender: Gender | null;
  zodiacSign: ZodiacSign | null;
  /** id старшего аркана из колоды, например "major-01"; null — не выбрана. */
  patronCard: string | null;
  isAdmin: boolean;
}

function toProfile(data: ProfileDTO): Profile {
  return {
    interests: data.interests ?? "",
    notificationsEnabled: data.notifications_enabled,
    gender: data.gender,
    zodiacSign: data.zodiac_sign,
    patronCard: data.patron_card,
    isAdmin: data.is_admin,
  };
}

export async function fetchProfile(): Promise<Profile> {
  const response = await authedFetch("/api/profile");
  return toProfile((await response.json()) as ProfileDTO);
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

export async function updateNotifications(enabled: boolean): Promise<void> {
  await authedPatch("/api/profile/notifications", { enabled });
}

export async function completeOnboarding(gender: Gender, zodiacSign: ZodiacSign): Promise<void> {
  await authedPatch("/api/profile/onboarding", { gender, zodiac_sign: zodiacSign });
}

export async function updateZodiac(zodiacSign: ZodiacSign): Promise<void> {
  await authedPatch("/api/profile/zodiac", { zodiac_sign: zodiacSign });
}

/** `null` снимает выбор карты-покровителя. */
export async function updatePatronCard(patronCard: string | null): Promise<void> {
  await authedPatch("/api/profile/patron-card", { patron_card: patronCard });
}
