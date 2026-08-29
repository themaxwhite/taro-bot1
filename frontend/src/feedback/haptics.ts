/**
 * Тактильная отдача Telegram.
 *
 * Родной для мини-приложения способ подтвердить касание: телефон
 * отзывается так же, как на действия в самом мессенджере, и это работает
 * даже когда звук выключен — а выключен он у многих.
 *
 * Появился в Bot API 6.1, поэтому вызовы закрыты проверкой версии: в
 * старом клиенте метода просто нет, и обращение к нему уронило бы
 * обработчик касания. Ошибки гасятся по той же причине, что и в
 * sound.ts — это украшение, а не функциональность.
 */

function haptic() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.HapticFeedback) return null;
  if (webApp.isVersionAtLeast && !webApp.isVersionAtLeast("6.1")) return null;
  return webApp.HapticFeedback;
}

/** Касание элемента выбора — карты в колоде, плитки расклада. */
export function hapticTap(): void {
  try {
    haptic()?.impactOccurred("light");
  } catch {
    // Игнорируем: отдача не критична.
  }
}

/** Действие завершилось — расклад собран, покупка прошла. */
export function hapticSuccess(): void {
  try {
    haptic()?.notificationOccurred("success");
  } catch {
    // Игнорируем.
  }
}
