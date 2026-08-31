/**
 * Вход в панель.
 *
 * Раньше здесь был виджет Telegram: скрипт рисовал кнопку и отдавал
 * подписанные данные прямо в страницу. Telegram его отключил — кнопка
 * ещё рисуется, но на попытку входа отвечает словом "deprecated".
 * Замена — обычный OpenID Connect, и работает он иначе: браузер уходит
 * на Telegram, возвращается на бэкенд, а тот возвращает его сюда уже с
 * готовым пропуском в адресе.
 *
 * Почему через бэкенд, а не целиком в браузере: Telegram принимает обмен
 * кода на токен только вместе с секретом клиента, а секрету в браузере не
 * место. Поэтому весь обмен происходит на сервере, а панель получает
 * короткий подписанный пропуск, по которому дальше и ходит.
 *
 * Пароля по-прежнему нет: кто администратор, решает список
 * ADMIN_TELEGRAM_IDS на сервере.
 */

export type AdminSession = {
  token: string;
  name: string;
};

const STORAGE_KEY = "taro-admin:session";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string)?.replace(/\/$/, "") ?? "";

/** Куда вести браузер по нажатию кнопки входа. */
export const LOGIN_URL = `${API_BASE}/api/admin/oauth/start`;

/* Что бэкенд может сообщить вместо пропуска. Тексты здесь, а не на
   сервере: сервер отдаёт короткий код, панель показывает человеку фразу. */
const ERRORS: Record<string, string> = {
  denied: "Вход отменён.",
  not_admin: "Этот аккаунт Telegram не в списке администраторов.",
  expired: "Вход слишком долго не подтверждали, попробуйте заново.",
  expired_token: "Telegram вернул просроченный ответ, попробуйте заново.",
  token: "Не удалось получить ответ от Telegram. Попробуйте ещё раз.",
  issuer: "Ответ пришёл не от Telegram — вход отклонён.",
  audience: "Ответ Telegram выписан другому приложению — вход отклонён.",
  subject: "Telegram не сообщил, кто вошёл.",
  bad_request: "Telegram вернул неполный ответ.",
};

export function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    return parsed?.token ? parsed : null;
  } catch {
    // Приватный режим и заблокированное хранилище кидают исключение на
    // самом обращении к localStorage — это не повод падать целиком.
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* не сохранили — вход проживёт до перезагрузки страницы */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* пусто */
  }
}

/**
 * Разбирает адрес после возврата из Telegram.
 *
 * Пропуск приходит во фрагменте (после «#»), а не в обычных параметрах:
 * фрагмент не уходит на сервер и не попадает в логи веб-сервера и в
 * заголовок Referer. Сразу после чтения он вычищается из адресной строки,
 * чтобы не остаться в истории браузера.
 */
export function readRedirect(): { session?: AdminSession; error?: string } {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return {};

  const params = new URLSearchParams(hash);
  const token = params.get("session");
  const error = params.get("error");
  if (!token && !error) return {};

  window.history.replaceState(null, "", window.location.pathname);

  if (token) return { session: { token, name: params.get("name") ?? "" } };
  return { error: ERRORS[error ?? ""] ?? "Войти не удалось." };
}
