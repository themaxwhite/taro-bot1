import { useEffect, useRef } from "react";

/** Adds the `reveal` class the first time the element scrolls into view.
 *  Elements start visible in the markup, so if IntersectionObserver is
 *  unavailable the page simply renders without the animation instead of
 *  leaving whole sections blank. */
export function useReveal<T extends HTMLElement>(delayMs = 0) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    el.style.opacity = "0";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.style.opacity = "";
          el.style.animationDelay = `${delayMs}ms`;
          el.classList.add("reveal");
          observer.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs]);

  return ref;
}
