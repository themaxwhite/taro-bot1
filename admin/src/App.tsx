import { useCallback, useEffect, useState } from "react";
import {
  clearSession,
  loadSession,
  readRedirect,
  saveSession,
  type AdminSession,
} from "./auth";
import { LoginScreen } from "./LoginScreen";
import { StatsScreen } from "./StatsScreen";
import { UsersScreen } from "./UsersScreen";

type Tab = "stats" | "users";

/* Возврат из Telegram разбираем один раз, до первой отрисовки: пропуск
   приходит в адресе, и держать его там дольше необходимого незачем. */
const redirect = readRedirect();
if (redirect.session) saveSession(redirect.session);

export default function App() {
  const [session, setSession] = useState<AdminSession | null>(
    () => redirect.session ?? loadSession(),
  );
  const [error, setError] = useState<string | null>(redirect.error ?? null);
  const [tab, setTab] = useState<Tab>("stats");

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setError(null);
  }, []);

  /* Экраны сообщают сюда об отказах доступа. 401 и 403 означают, что
     показывать больше нечего: пропуск протух или аккаунт не админский —
     и в обоих случаях правильнее вернуть человека на вход с объяснением,
     чем оставить смотреть на пустую таблицу. */
  const handleAuthError = useCallback((message: string) => {
    if (message.includes("Вход устарел") || message.includes("не в списке")) {
      clearSession();
      setSession(null);
      setError(message);
    }
  }, []);

  useEffect(() => {
    document.title = session ? "Панель — Taro Aurum" : "Вход — Taro Aurum";
  }, [session]);

  if (!session) {
    return <LoginScreen error={error} />;
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <b>Taro Aurum</b> · панель
        </div>
        <div className="who">
          {session.name}{" "}
          <button type="button" className="link" onClick={logout}>
            выйти
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button type="button" aria-current={tab === "stats"} onClick={() => setTab("stats")}>
          Сводка
        </button>
        <button type="button" aria-current={tab === "users"} onClick={() => setTab("users")}>
          Пользователи
        </button>
      </nav>

      {tab === "stats" ? (
        <StatsScreen session={session} onAuthError={handleAuthError} />
      ) : (
        <UsersScreen session={session} onAuthError={handleAuthError} />
      )}
    </div>
  );
}
