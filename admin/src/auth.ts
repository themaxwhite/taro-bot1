/**
 * Вход в панель через виджет Telegram Login.
 *
 * Пароля здесь нет намеренно. Права администратора и так определяются
 * списком ADMIN_TELEGRAM_IDS на бэкенде, то есть по идентификатору
 * Telegram — заводить рядом отдельный пароль значит завести второй способ
 * попасть внутрь и второе место, откуда его можно украсть.
 *
 * Telegram отдаёт подписанные данные о вошедшем. Панель хранит их и
 * прикладывает к каждому запросу, а бэкенд каждый раз проверяет подпись
 * токеном бота (app/telegram/auth.py::validate_login_widget). То есть это
 * не сессия на сервере, а пропуск с собственной подписью — сервер не
 * хранит о входе ничего.
 *
 * Срок жизни пропуска — сутки, ограничение стоит на стороне бэкенда. По
 * истечении панель просто просит войти заново.
 */

export type TelegramLoginPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const STORAGE_KEY = "taro-admin:auth";

export const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string;

export function loadAuth(): TelegramLoginPayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TelegramLoginPayload;
    return parsed?.hash ? parsed : null;
  } catch {
    // Приватный режим и заблокированное хранилище кидают исключение на
    // самом обращении к localStorage — это не повод падать целиком.
    return null;
  }
}

export function saveAuth(payload: TelegramLoginPayload): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* не смогли сохранить — вход проживёт до перезагрузки страницы */
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* пусто */
  }
}

/**
 * Заголовок для запросов: base64 от JSON.
 *
 * Именно base64, а не сам JSON: в данных есть имя пользователя, а в
 * значение HTTP-заголовка нельзя положить кириллицу — браузер отвергнет
 * такой запрос ещё до отправки.
 */
export function authHeader(payload: TelegramLoginPayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}
