import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  /** Цена вопроса приходит с сервера — на экране её не хардкодим. */
  cost: number;
  balance: number;
}

export interface ChatAnswer {
  question: ChatMessage;
  answer: ChatMessage;
  balance: number;
}

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
  };
}

/**
 * Разбирает отказ сервера. Текст берётся из `detail`, потому что
 * бэкенд объясняет причину по-русски и человеку (не хватает энергии,
 * тема под запретом, таролог не отвечает) — своя формулировка здесь
 * была бы менее точной.
 */
async function fail(response: Response): Promise<never> {
  let detail: string | null = null;
  try {
    const body = (await response.json()) as { detail?: string };
    detail = body.detail ?? null;
  } catch {
    // Ответ без JSON — обойдёмся общим текстом ниже.
  }
  throw new SpreadsApiError(detail ?? `Сервер вернул ошибку (${response.status}).`, response.status);
}

export async function fetchChat(): Promise<ChatHistory> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, { headers: headers() });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }
  if (!response.ok) await fail(response);
  return (await response.json()) as ChatHistory;
}

export async function askTarologist(question: string): Promise<ChatAnswer> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ question }),
    });
  } catch {
    throw new SpreadsApiError("Не удалось связаться с сервером. Проверьте подключение.");
  }
  if (!response.ok) await fail(response);
  return (await response.json()) as ChatAnswer;
}
