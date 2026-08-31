import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* В отличие от мини-приложения здесь обычный сайт на своём домене, поэтому
   пути абсолютные — относительные нужны только внутри Telegram. */
export default defineConfig({
  plugins: [react()],
  /* Время сборки видно на экране входа. Панель выкатывается вручную, и
     открытая вкладка со старой версией внешне неотличима от новой — эта
     строчка отвечает на вопрос «а точно ли у меня свежая страница». */
  define: {
    __BUILD_TIME__: JSON.stringify(
      new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }),
    ),
  },
  server: {
    host: true,
    port: 5174,
  },
});
