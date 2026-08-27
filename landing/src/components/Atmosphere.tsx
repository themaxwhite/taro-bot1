import { useEffect } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * The three things that make the page feel shot rather than rendered: a pool
 * of candlelight that follows the pointer, film grain over everything, and a
 * vignette pulling the corners down.
 *
 * Grain and vignette are pure CSS on <body>; only the spotlight needs a
 * listener, and it writes two custom properties rather than re-rendering.
 */
export function Atmosphere() {
  const reduced = useReducedMotion();

  useEffect(() => {
    const body = document.body;
    body.classList.add("vignette");
    if (!reduced) body.classList.add("grain");
    return () => body.classList.remove("vignette", "grain");
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;

    const write = () => {
      frame = 0;
      root.style.setProperty("--mx", `${x}px`);
      root.style.setProperty("--my", `${y}px`);
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(write);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      root.style.removeProperty("--mx");
      root.style.removeProperty("--my");
    };
  }, [reduced]);

  if (reduced) return null;
  return <div aria-hidden="true" className="spotlight" />;
}
