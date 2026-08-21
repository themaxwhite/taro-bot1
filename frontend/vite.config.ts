import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Telegram Mini App requires relative asset paths so the app works
// correctly when opened inside Telegram's in-app browser.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
});
