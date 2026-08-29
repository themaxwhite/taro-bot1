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

interface AskResult {
  questionId: number;
  answerId: number;
  balance: number;
}

/**
 * Задаёт вопрос и отдаёт ответ по мере генерации.
 *
 * Сервер шлёт Server-Sent Events: `chunk` с куском текста, затем `done`
 * с идентификаторами и новым балансом, либо `error`. Поток, а не один
 * ответ, — чтобы первые слова появились сразу, а не после того, как
 * модель закончит целиком.
 *
 * Отказы до начала генерации (пустой вопрос, запрещённая тема, не
 * хватает энергии) приходят обычными кодами HTTP и превращаются в
 * SpreadsApiError, как и раньше: экран разбирает их по `status`.
 */
export async function askTarologist(
  question: string,
  onChunk: (text: string) => void,
): Promise<AskResult> {
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
  if (!response.body) throw new SpreadsApiError("Сервер не прислал ответ.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // Кусок сети может оборваться посреди строки события, поэтому хвост
  // без перевода строки переносим в следующую итерацию.
  let buffer = "";
  let result: AskResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const event = JSON.parse(line.slice(5).trim()) as {
        type: "chunk" | "done" | "error";
        text?: string;
        detail?: string;
        question_id?: number;
        answer_id?: number;
        balance?: number;
      };
      if (event.type === "chunk" && event.text) {
        onChunk(event.text);
      } else if (event.type === "error") {
        throw new SpreadsApiError(event.detail ?? "Таролог не ответил.");
      } else if (event.type === "done") {
        result = {
          questionId: event.question_id ?? 0,
          answerId: event.answer_id ?? 0,
          balance: event.balance ?? 0,
        };
      }
    }
  }

  if (!result) throw new SpreadsApiError("Ответ оборвался. Энергия не списана.");
  return result;
}
