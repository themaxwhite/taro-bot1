/**
 * Запрос к бэкенду, который обязан когда-нибудь закончиться.
 *
 * `fetch` сам по себе не сдаётся никогда: если соединение встало —
 * телефон ушёл в лифт, сеть переключилась с Wi-Fi на мобильную, — обещание
 * просто не выполняется, и экран остаётся с крутилкой навсегда. Человек
 * видит зависшее приложение и не понимает, ждать ему или закрывать.
 *
 * Двадцати секунд хватает с запасом на самое долгое, что у нас есть:
 * бэкенд ждёт модель не дольше десяти, остальное — дорога. Если ответа
 * нет и после этого, дело не в медленной сети, и честнее сказать об этом,
 * чем изображать работу.
 */

const DEFAULT_TIMEOUT_MS = 20_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Что показать человеку, когда запрос не дошёл.
 *
 * Разделяем два случая, потому что и делать в них нужно разное: сеть
 * пропала — проверить подключение; сервер молчит — просто попробовать
 * ещё раз, с подключением всё в порядке.
 */
export function networkErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Сервер не ответил. Попробуйте ещё раз.";
  }
  return "Не удалось связаться с сервером. Проверьте подключение.";
}
