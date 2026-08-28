import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface DailyStory {
  author: string;
  spreadTitle: string;
  text: string;
}

/**
 * История дня — одна на всех, меняется раз в сутки (UTC). Истории
 * вымышленные, и интерфейс обязан говорить об этом прямо: см.
 * components/DailyStory.
 */
export async function getDailyStory(): Promise<DailyStory> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/daily-story`, {
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером.");
  }
  if (!response.ok) {
    throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  }
  const data = (await response.json()) as { author: string; spread_title: string; text: string };
  return { author: data.author, spreadTitle: data.spread_title, text: data.text };
}
