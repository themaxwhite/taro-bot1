import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* В отличие от мини-приложения здесь обычный сайт на своём домене, поэтому
   пути абсолютные — относительные нужны только внутри Telegram. */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
  },
});
