import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

type TiltOptions = {
  /** Maximum rotation at the edges of the element, in degrees. */
  max?: number;
  /** How far the element drifts with the pointer, in pixels. */
  shift?: number;
};

/** Tilts the element toward the pointer and exposes the pointer position as
 *  `--px` / `--py` (0…1) so a gloss highlight can track the same point.
 *
 *  Attach `ref` to the element that moves and `areaRef` to the region whose
 *  pointer movement drives it — for the hero that is the whole column, so the
 *  cards react before the pointer is over any single one of them. */
export function useTilt<T extends HTMLElement, A extends HTMLElement = T>({
  max = 10,
  shift = 8,
}: TiltOptions = {}) {
  const ref = useRef<T>(null);
  const areaRef = useRef<A>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    const area = (areaRef.current ?? ref.current) as HTMLElement | null;
    if (!el || !area || reduced) return;
    /* Coarse pointers have no hover to track, and the tilt would only fight
       with scrolling. */
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let frame = 0;
    const apply = (px: number, py: number) => {
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
      el.style.setProperty("--rx", `${(0.5 - py) * 2 * max}deg`);
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--tx", `${(px - 0.5) * 2 * shift}px`);
      el.style.setProperty("--ty", `${(py - 0.5) * 2 * shift}px`);
    };

    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = area.getBoundingClientRect();
        apply(
          Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
          Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
        );
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      apply(0.5, 0.5);
    };

    apply(0.5, 0.5);
    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
    };
  }, [max, shift, reduced]);

  return { ref, areaRef };
}
