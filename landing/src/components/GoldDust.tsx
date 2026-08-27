import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

type Mote = { x: number; y: number; r: number; vy: number; drift: number; a: number };

/** Slow-rising gold motes behind the hero. Purely decorative, so it is
 *  aria-hidden, skipped entirely under reduced motion, and paused whenever the
 *  hero is off screen or the tab is in the background. */
export function GoldDust({ count = 46 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let frame = 0;
    let running = true;
    /* Pointer position in canvas space; motes lean away from it, which reads
       as the dust being disturbed by a hand passing over the table. */
    const pointer = { x: -1e4, y: -1e4 };

    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr());
      canvas.height = Math.round(height * dpr());
      ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.9,
        vy: 0.12 + Math.random() * 0.36,
        drift: (Math.random() - 0.5) * 0.22,
        a: 0.18 + Math.random() * 0.5,
      }));
    };

    const gold = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() ||
      "#b8935a";

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      const color = gold();
      for (const mote of motes) {
        mote.y -= mote.vy;
        mote.x += mote.drift;

        const dx = mote.x - pointer.x;
        const dy = mote.y - pointer.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < 130 * 130) {
          const push = (1 - Math.sqrt(distanceSq) / 130) * 1.4;
          mote.x += dx > 0 ? push : -push;
          mote.y += dy > 0 ? push : -push;
        }

        if (mote.y < -8) {
          mote.y = height + 8;
          mote.x = Math.random() * width;
        }
        if (mote.x < -8) mote.x = width + 8;
        if (mote.x > width + 8) mote.x = -8;

        ctx.globalAlpha = mote.a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    frame = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const viewObserver = new IntersectionObserver(
      ([entry]) => (entry?.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    viewObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      resizeObserver.disconnect();
      viewObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, reduced]);

  if (reduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
    />
  );
}
