import { useEffect } from "react";

/**
 * Перезапрашивает данные, когда человек возвращается в приложение.
 *
 * Мини-приложение не перезагружается: свернул, ушёл в другой чат, оплатил
 * на стороннем сайте, вернулся — это всё та же живая страница с теми же
 * данными, что были при открытии. Само по себе ничего не обновляется.
 *
 * Отсюда случай, ради которого хук и написан: человек уходит на форму
 * оплаты, платит, возвращается — и видит прежний баланс. Энергия уже
 * начислена на сервере, но экран об этом не знает, и выглядит это как
 * «деньги списались, а ничего не пришло».
 *
 * Слушаем два события, потому что они срабатывают в разных случаях:
 * `visibilitychange` — когда приложение свернули и развернули, `focus` —
 * когда поверх открывали встроенный браузер Telegram, а вкладка при этом
 * формально оставалась видимой.
 */
export function useRefreshOnReturn(refresh: () => void): void {
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [refresh]);
}
