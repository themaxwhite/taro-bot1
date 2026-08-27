import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "./useReducedMotion";

/* useLayoutEffect warns when React renders on the server, and the prerender
   step does exactly that. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Counts up to `target` the first time the element is seen.
 *
 *  Renders the final number straight away — that is what ends up in the
 *  prerendered HTML, so a crawler reads "78 карт", not "0 карт" — then resets
 *  to zero in a layout effect, before the browser paints, and animates back
 *  up. Under reduced motion the reset never happens. */
export function useCountUp(target: number, durationMs = 1100) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);

  useIsomorphicLayoutEffect(() => {
    if (reduced || typeof IntersectionObserver === "undefined") return;
    setValue(0);
  }, [reduced]);

  useEffect(() => {
    const el = ref.current;
    if (reduced || !el || typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          /* Ease-out cubic: fast first, settling on the exact target. */
          setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [target, durationMs, reduced]);

  return { ref, value };
}
