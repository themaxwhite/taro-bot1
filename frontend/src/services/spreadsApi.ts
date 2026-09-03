import { fetchWithTimeout, networkErrorMessage } from "./http";
import type { SpreadId } from "../types/tarot";
import type { DrawSpreadResponse } from "../types/result";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class SpreadsApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Calls the backend Tarot Engine to draw cards for the given spread.
 * All randomness/card resolution happens server-side — this is a thin
 * HTTP wrapper, no client-side card logic.
 */
export async function drawSpread(spreadId: SpreadId, question?: string): Promise<DrawSpreadResponse> {
  let response: Response;

  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/spreads/draw`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Backend validates this against the bot token (see
        // backend/app/telegram/auth.py). Empty string outside Telegram
        // (e.g. local browser dev) — backend only enforces this when
        // TELEGRAM_BOT_TOKEN is configured.
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
      body: JSON.stringify({ spread_id: spreadId, question: question || null }),
    });
  } catch (error) {
    throw new SpreadsApiError(networkErrorMessage(error));
  }

  if (response.status === 401) {
    throw new SpreadsApiError("Не удалось подтвердить пользователя Telegram.");
  }

  if (!response.ok) {
    // Бэкенд объясняет отказ в `detail` — например, почему вопрос не
    // прошёл ограничения. Без этого пользователь видел бы «ошибка 400»
    // и не понимал, что именно исправить.
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new SpreadsApiError(
      body?.detail ?? `Сервер вернул ошибку (${response.status}).`,
      response.status,
    );
  }

  return (await response.json()) as DrawSpreadResponse;
}

/**
 * Read-only check for whether today's "карта дня" was already drawn —
 * unlike drawSpread(), this never creates one, so MainScreen can show
 * the cooldown above the banner without spoiling the deck-selection
 * ritual for a card that hasn't been picked yet.
 */
export async function getDailyCardStatus(): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/spreads/daily-card/status`, {
      headers: { "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "" },
    });
  } catch {
    return null; // best-effort — the banner just falls back to its normal look
  }
  if (!response.ok) return null;
  const data = (await response.json()) as { next_available_at: string | null };
  return data.next_available_at;
}

/**
 * Заранее проверяет вопрос на ограничения, чтобы отказ показался под
 * полем ввода, а не после вытягивания карт. Главная проверка всё равно
 * на розыгрыше (backend/app/api/spreads.py) — эта только для UX.
 *
 * Возвращает причину отказа или null, если вопрос допустим. Сбой сети
 * тоже даёт null: не мешаем человеку из-за неработающей проверки —
 * розыгрыш всё равно не пропустит запрещённое.
 */
export async function checkQuestion(question: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/spreads/check-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData ?? "",
      },
      body: JSON.stringify({ question }),
    });
  } catch {
    return null;
  }

  if (response.ok) return null;

  const body = (await response.json().catch(() => null)) as { detail?: string } | null;
  return body?.detail ?? null;
}
