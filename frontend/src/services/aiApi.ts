import { fetchWithTimeout, networkErrorMessage } from "./http";
import type { DrawnCard, DrawSpreadResponse } from "../types/result";
import { SpreadsApiError } from "./spreadsApi";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function api(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new SpreadsApiError(networkErrorMessage(error));
  }
  if (response.status === 401) {
    throw new SpreadsApiError("Не удалось подтвердить пользователя Telegram.");
  }
  if (response.status === 402) {
    const body = await response.json().catch(() => null);
    throw new SpreadsApiError(body?.detail ?? "Эта функция платная — сначала нужно оформить подписку.", 402);
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => null);
    throw new SpreadsApiError(body?.detail ?? "Эта функция недоступна на вашем тарифе.", 403);
  }
  if (!response.ok) {
    throw new SpreadsApiError(`Сервер вернул ошибку (${response.status}).`);
  }
  return response;
}

export async function fetchDailyMessage(): Promise<string> {
  const response = await api("/api/daily-message");
  const data = (await response.json()) as { text: string };
  return data.text;
}

/**
 * Разблокирует расклад: одна единица энергии открывает и карты, и
 * толкование сразу, поэтому карты приезжают в том же ответе — до этого
 * момента backend их не отдавал вовсе.
 */
export async function fetchInterpretation(
  spreadRecordId: number,
): Promise<{ interpretation: string; cards: DrawnCard[] }> {
  const response = await api(`/api/spreads/${spreadRecordId}/interpret`, { method: "POST" });
  const data = (await response.json()) as { interpretation: string; cards: DrawnCard[] };
  return { interpretation: data.interpretation, cards: data.cards };
}

export async function drawExtraCard(spreadRecordId: number): Promise<DrawSpreadResponse> {
  const response = await api(`/api/spreads/${spreadRecordId}/draw-extra`, { method: "POST" });
  return (await response.json()) as DrawSpreadResponse;
}

export interface FollowUpAnswer {
  questionKey: string;
  questionLabel: string;
  answer: string;
}

interface FollowUpDTO {
  question_key: string;
  question_label: string;
  answer: string;
}

export async function fetchFollowUpAnswer(spreadRecordId: number, questionKey: string): Promise<FollowUpAnswer> {
  const response = await api(`/api/spreads/${spreadRecordId}/follow-up`, {
    method: "POST",
    body: JSON.stringify({ question_key: questionKey }),
  });
  const data = (await response.json()) as FollowUpDTO;
  return { questionKey: data.question_key, questionLabel: data.question_label, answer: data.answer };
}

/** Премиум-exclusive: any free-text follow-up question, not just the preset list. */
export async function fetchCustomFollowUpAnswer(spreadRecordId: number, customQuestion: string): Promise<FollowUpAnswer> {
  const response = await api(`/api/spreads/${spreadRecordId}/follow-up`, {
    method: "POST",
    body: JSON.stringify({ custom_question: customQuestion }),
  });
  const data = (await response.json()) as FollowUpDTO;
  return { questionKey: data.question_key, questionLabel: data.question_label, answer: data.answer };
}
