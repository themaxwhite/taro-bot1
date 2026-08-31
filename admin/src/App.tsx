import { useCallback, useState } from "react";
import { clearAuth, loadAuth, saveAuth, type TelegramLoginPayload } from "./auth";
import { LoginScreen } from "./LoginScreen";
import { StatsScreen } from "./StatsScreen";
import { UsersScreen } from "./UsersScreen";

type Tab = "stats" | "users";

export default function App() {
  const [auth, setAuth] = useState<TelegramLoginPayload | null>(loadAuth);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("stats");

  const login = useCallback((payload: TelegramLoginPayload) => {
    saveAuth(payload);
    setLoginError(null);
    setAuth(payload);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  /* Экраны сообщают сюда об ошибках доступа. 401 и 403 означают, что
     дальше показывать нечего: пропуск протух или аккаунт не админский —
     и в обоих случаях правильнее вернуть человека на вход с объяснением,
     чем оставить его смотреть на пустую таблицу. */
  const handleAuthError = useCallback((message: string) => {
    if (message.includes("Вход устарел") || message.includes("не в списке")) {
      clearAuth();
      setAuth(null);
      setLoginError(message);
    }
  }, []);

  if (!auth) {
    return <LoginScreen onLogin={login} error={loginError} />;
  }

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="brand">
          <b>Taro Aurum</b> · панель
        </div>
        <div className="who">
          {auth.first_name}
          {auth.username ? ` @${auth.username}` : ""}{" "}
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
        <StatsScreen auth={auth} onAuthError={handleAuthError} />
      ) : (
        <UsersScreen auth={auth} onAuthError={handleAuthError} />
      )}
    </div>
  );
}
