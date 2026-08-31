import { useEffect, useRef, useState } from "react";
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

/* Сколько ждать появления кнопки, прежде чем признать, что она не придёт.
   Скрипт Telegram вставляет iframe сразу после загрузки, так что пяти
   секунд хватает даже на медленной сети. */
const WIDGET_TIMEOUT_MS = 5000;

export function LoginScreen({ onLogin, error }: Props) {
  const slot = useRef<HTMLDivElement>(null);
  /* Молчаливый отказ — худший вид отказа: экран выглядит целым, просто на
     нём нечего нажать, и причина ничем не выдаёт себя. Поэтому следим и за
     ошибкой загрузки скрипта, и за тем, появилась ли вообще кнопка. */
  const [problem, setProblem] = useState<"script" | "widget" | null>(null);

  useEffect(() => {
    const container = slot.current;
    if (!container || !BOT_USERNAME) return;

    window.onTelegramAuth = onLogin;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.onerror = () => setProblem("script");
    container.appendChild(script);

    const timer = window.setTimeout(() => {
      if (!container.querySelector("iframe")) setProblem("widget");
    }, WIDGET_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
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

        {problem === "script" && (
          <p className="error" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
            Не удалось загрузить скрипт с telegram.org. Обычно это блокировщик
            рекламы или сеть, режущая домен Telegram.
          </p>
        )}

        {problem === "widget" && (
          <div style={{ marginTop: "1.25rem", textAlign: "left" }}>
            <p className="error" style={{ marginBottom: "0.5rem" }}>
              Скрипт загрузился, но кнопку не показал.
            </p>
            <p className="muted" style={{ marginBottom: "0.5rem", fontSize: "0.85rem" }}>
              Telegram рисует кнопку только на домене, привязанном к боту.
              Проверьте в BotFather: <code>/mybots</code> → @{BOT_USERNAME} →
              Bot Settings → Domain. Там должно стоять ровно{" "}
              <code>{window.location.hostname}</code> — без «https://» и без
              слэша в конце.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Точную причину покажет консоль браузера (F12): виджет пишет туда
              «Bot domain invalid», если домен не совпал.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
