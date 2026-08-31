import { LOGIN_URL } from "./auth";

type Props = {
  error?: string | null;
};

export function LoginScreen({ error }: Props) {
  return (
    <div className="login">
      <div className="card">
        <h1>Панель Taro Aurum</h1>
        <p>
          Вход по аккаунту Telegram. Доступ открыт только тем, кто указан в
          списке администраторов на сервере.
        </p>

        {/* Обычная ссылка, а не fetch: вход — это переход браузера на
            Telegram и обратно, и делать его из скрипта незачем. Заодно
            работает при отключённом JavaScript и не ломается блокировщиками. */}
        <a className="login-button" href={LOGIN_URL}>
          Войти через Telegram
        </a>

        {error && (
          <p className="error" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
