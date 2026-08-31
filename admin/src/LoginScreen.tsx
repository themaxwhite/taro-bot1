import { useEffect, useRef } from "react";
import { BOT_USERNAME, type TelegramLoginPayload } from "./auth";

declare global {
  interface Window {
    /* Виджет вызывает функцию по имени из data-onauth, поэтому она обязана
       быть глобальной — обойтись замыканием нельзя. */
    onTelegramAuth?: (user: TelegramLoginPayload) => void;
  }
}

type Props = {
  onLogin: (payload: TelegramLoginPayload) => void;
  error?: string | null;
};

export function LoginScreen({ onLogin, error }: Props) {
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = slot.current;
    if (!container) return;

    window.onTelegramAuth = onLogin;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      delete window.onTelegramAuth;
    };
  }, [onLogin]);

  return (
    <div className="login">
      <div className="card">
        <h1>Панель Taro Aurum</h1>
        <p>
          Вход по аккаунту Telegram. Доступ открыт только тем, кто указан в
          списке администраторов на сервере.
        </p>

        <div ref={slot} />

        {error && (
          <p className="error" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
            {error}
          </p>
        )}

        {!BOT_USERNAME && (
          <p className="error" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
            Не задан VITE_BOT_USERNAME — кнопке входа неоткуда взять бота.
          </p>
        )}
      </div>
    </div>
  );
}
