/**
 * Яндекс.Метрика.
 *
 * Счётчик подключается только если задан VITE_METRIKA_ID — без номера
 * ничего не грузится вовсе. Так локальная разработка и превью-выкатки не
 * засоряют статистику, а сам файл можно держать в репозитории до того, как
 * счётчик заведён.
 *
 * Вебвизор намеренно выключен. Он записывает движения мыши, прокрутку и
 * ввод в поля — то есть поведение конкретного посетителя, а не обезличенную
 * статистику. Для сайта из одной страницы он не даёт почти ничего, зато
 * заметно утяжеляет то, что нужно описывать в политике обработки данных.
 * Понадобится — включается одним флагом здесь и правкой политики, но по
 * умолчанию мы собираем минимум.
 */

const METRIKA_ID = import.meta.env.VITE_METRIKA_ID as string | undefined;

declare global {
  interface Window {
    ym?: ((id: number, action: string, ...args: unknown[]) => void) & {
      a?: unknown[][];
      l?: number;
    };
  }
}

export function initAnalytics(): void {
  const id = Number(METRIKA_ID);
  if (!id || Number.isNaN(id)) return;
  if (window.ym) return; // повторная инициализация при hot reload

  // Очередь вызовов до загрузки tag.js — стандартная обвязка Метрики,
  // переписанная без eval и document.write из их сниппета.
  const queue: unknown[][] = [];
  const ym = ((...args: unknown[]) => {
    queue.push(args);
  }) as NonNullable<Window["ym"]>;
  ym.a = queue;
  ym.l = Date.now();
  window.ym = ym;

  const script = document.createElement("script");
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  script.async = true;
  document.head.appendChild(script);

  window.ym(id, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: false,
  });
}
