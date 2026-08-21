import type { DrawSpreadResponse } from "../types/result";
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
  if (response.status === 401) {
    throw new SpreadsApiError("Не удалось подтвердить пользователя Telegram.");
  }
  if (response.status === 402) {
    throw new SpreadsApiError("Эта функция платная — сначала нужно оплатить.");
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

export async function fetchInterpretation(spreadRecordId: number): Promise<string> {
  const response = await api(`/api/spreads/${spreadRecordId}/interpret`, { method: "POST" });
  const data = (await response.json()) as { interpretation: string };
  return data.interpretation;
}

export async function drawExtraCard(spreadRecordId: number): Promise<DrawSpreadResponse> {
  const response = await api(`/api/spreads/${spreadRecordId}/draw-extra`, { method: "POST" });
  return (await response.json()) as DrawSpreadResponse;
}

export type PurchaseProduct = "interpretation" | "extra_card";

export async function createInvoice(
  product: PurchaseProduct,
  spreadRecordId: number,
): Promise<{ invoiceLink: string; payload: string }> {
  const response = await api("/api/payments/create-invoice", {
    method: "POST",
    body: JSON.stringify({ product, spread_record_id: spreadRecordId }),
  });
  const data = (await response.json()) as { invoice_link: string; payload: string };
  return { invoiceLink: data.invoice_link, payload: data.payload };
}

export async function getPaymentStatus(payload: string): Promise<"pending" | "paid"> {
  const response = await api(`/api/payments/status?payload=${encodeURIComponent(payload)}`);
  const data = (await response.json()) as { status: "pending" | "paid" };
  return data.status;
}

/**
 * Opens the Telegram Stars payment sheet for an invoice link and resolves
 * once the backend confirms the purchase as paid (polling — the
 * `openInvoice` client callback and the webhook that actually flips
 * `Purchase.status` can arrive slightly out of order, so this waits for
 * the source of truth rather than trusting the callback alone).
 */
export async function payWithStars(product: PurchaseProduct, spreadRecordId: number): Promise<void> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp) {
    throw new SpreadsApiError("Оплата доступна только внутри Telegram.");
  }

  const { invoiceLink, payload } = await createInvoice(product, spreadRecordId);

  const clientStatus = await new Promise<string>((resolve) => {
    webApp.openInvoice(invoiceLink, resolve);
  });
  if (clientStatus !== "paid") {
    throw new SpreadsApiError(
      clientStatus === "cancelled" ? "Оплата отменена." : "Оплата не прошла. Попробуйте ещё раз.",
    );
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await getPaymentStatus(payload);
    if (status === "paid") return;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new SpreadsApiError("Оплата подтверждается дольше обычного — попробуйте открыть толкование ещё раз через минуту.");
}
