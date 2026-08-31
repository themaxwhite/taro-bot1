import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { initAnalytics } from "./analytics";
import App from "./App";
import "./index.css";

const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

/* The production build ships prerendered markup (scripts/prerender.mjs); the
   dev server ships an empty root, so pick the matching entry point. */
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}

/* После гидрации, а не до неё: счётчик не должен задерживать первую
   отрисовку — она и есть то, что меряет Core Web Vitals. */
initAnalytics();
