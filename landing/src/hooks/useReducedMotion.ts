import { useEffect, useState } from "react";

/** Every effect on this page checks this first: with reduced motion the page
 *  keeps all of its content and loses only the movement.
 *
 *  Starts as `false` rather than reading the media query during render — the
 *  page is prerendered on the server, where there is no `window`, and the
 *  first client render has to match that markup. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
