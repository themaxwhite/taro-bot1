import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * The page's backdrop: occult line-art silhouettes drifting behind the
 * content at different speeds.
 *
 * Everything here is inline SVG built from circles, arcs and polygons — no
 * images, no requests, and it scales to any viewport without going soft. The
 * whole layer is fixed and aria-hidden; the parallax is one scroll listener
 * writing a transform onto each layer, which is cheap enough to run on the
 * main thread and stops entirely under reduced motion.
 */
export function Silhouettes() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    const layers = Array.from(
      root.querySelectorAll<HTMLElement>("[data-speed]"),
    );
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      for (const layer of layers) {
        const speed = Number(layer.dataset.speed ?? 0);
        layer.style.transform = `translate3d(0, ${(-y * speed).toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Base wash: a cold moonlit corner and a warm candlelit one. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70rem 46rem at 78% -6%, color-mix(in srgb, var(--mist) 14%, transparent), transparent 68%), radial-gradient(56rem 40rem at 6% 22%, color-mix(in srgb, var(--gold) 9%, transparent), transparent 70%)",
        }}
      />

      {/* Moon, high and to the right, barely moving as you scroll. */}
      <div
        data-speed="0.06"
        className="absolute -top-16 right-[-6rem] w-[26rem] text-mist opacity-[0.16] sm:right-[-4rem] sm:w-[34rem]"
      >
        <Moon />
      </div>

      {/* Astrolabe wheel, turning very slowly behind the middle of the page. */}
      <div
        data-speed="0.14"
        className="absolute top-[16%] left-[-14rem] w-[26rem] text-gold opacity-[0.09] sm:left-[-8rem] sm:w-[46rem]"
      >
        <div className="spin-slow">
          <Astrolabe />
        </div>
      </div>

      {/* Eye in a triangle — the one overtly occult shape, kept faint. */}
      <div
        data-speed="0.2"
        className="absolute top-[36%] right-[-6rem] hidden w-[26rem] text-gold opacity-[0.1] lg:block"
      >
        <div className="drift">
          <EyeSigil />
        </div>
      </div>

      {/* Fanned cards, low and large, behind the lower half. */}
      <div
        data-speed="0.1"
        className="absolute top-[58%] left-[-6rem] w-[22rem] text-gold opacity-[0.08] sm:left-[-4rem] sm:w-[40rem]"
      >
        <FannedCards />
      </div>

      {/* Phases of the moon, a quiet horizontal rhythm. */}
      <div
        data-speed="0.26"
        className="absolute top-[78%] right-8 hidden w-[30rem] text-mist opacity-[0.14] md:block"
      >
        <Phases />
      </div>

      {/* Ridge line and horizon that the footer sits on. */}
      <div
        data-speed="0.04"
        className="absolute right-0 bottom-0 left-0 text-gold opacity-[0.12]"
      >
        <Ridge />
      </div>

      <Stars />
    </div>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 400 400" fill="none" className="w-full">
      <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="200"
        cy="200"
        r="172"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeDasharray="3 9"
      />
      <circle cx="200" cy="200" r="150" fill="currentColor" opacity="0.13" />
      {[
        [158, 150, 26],
        [246, 176, 17],
        [196, 258, 22],
        [140, 232, 12],
        [258, 246, 9],
      ].map(([cx, cy, r]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={r}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

function Astrolabe() {
  /* Twelve houses, a ring of ticks and a rotated inner square — the geometry of
     an astrological chart without pretending to be an accurate one. */
  const spokes = Array.from({ length: 12 }, (_, i) => i * 30);
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);

  return (
    <svg viewBox="0 0 400 400" fill="none" className="w-full">
      <g stroke="currentColor">
        <circle cx="200" cy="200" r="190" strokeWidth="1" />
        <circle cx="200" cy="200" r="164" strokeWidth="0.75" />
        <circle cx="200" cy="200" r="112" strokeWidth="1" />
        <circle cx="200" cy="200" r="58" strokeWidth="0.75" />
        {spokes.map((angle) => (
          <line
            key={angle}
            x1="200"
            y1="10"
            x2="200"
            y2="36"
            strokeWidth="1.4"
            transform={`rotate(${angle} 200 200)`}
          />
        ))}
        {spokes.map((angle) => (
          <line
            key={`spoke-${angle}`}
            x1="200"
            y1="88"
            x2="200"
            y2="112"
            strokeWidth="0.8"
            transform={`rotate(${angle} 200 200)`}
          />
        ))}
        {ticks.map((angle) => (
          <line
            key={`tick-${angle}`}
            x1="200"
            y1="164"
            x2="200"
            y2="176"
            strokeWidth="0.6"
            opacity="0.7"
            transform={`rotate(${angle} 200 200)`}
          />
        ))}
        <rect
          x="118"
          y="118"
          width="164"
          height="164"
          strokeWidth="0.9"
          transform="rotate(45 200 200)"
        />
        <rect x="118" y="118" width="164" height="164" strokeWidth="0.9" />
      </g>
    </svg>
  );
}

function EyeSigil() {
  return (
    <svg viewBox="0 0 400 340" fill="none" className="w-full">
      <g stroke="currentColor" strokeWidth="1.4">
        <path d="M200 24 372 320H28Z" />
        <path d="M200 62 336 300H64Z" strokeWidth="0.7" opacity="0.6" />
        <path d="M110 214c50-56 130-56 180 0-50 56-130 56-180 0Z" />
        <circle cx="200" cy="214" r="34" />
        <circle cx="200" cy="214" r="13" fill="currentColor" opacity="0.5" />
        {Array.from({ length: 12 }, (_, i) => i * 30).map((angle) => (
          <line
            key={angle}
            x1="200"
            y1="152"
            x2="200"
            y2="132"
            strokeWidth="0.9"
            opacity="0.55"
            transform={`rotate(${angle} 200 214)`}
          />
        ))}
      </g>
    </svg>
  );
}

function FannedCards() {
  const cards = [-34, -17, 0, 17, 34];
  return (
    <svg viewBox="0 0 420 360" fill="none" className="w-full">
      <g stroke="currentColor" strokeWidth="1.4">
        {cards.map((angle) => (
          <g key={angle} transform={`rotate(${angle} 210 340)`}>
            <rect x="168" y="96" width="84" height="140" rx="8" />
            <rect
              x="176"
              y="104"
              width="68"
              height="124"
              rx="5"
              strokeWidth="0.6"
              opacity="0.6"
            />
            <circle cx="210" cy="166" r="14" strokeWidth="0.8" opacity="0.7" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function Phases() {
  /* Eight discs from new to full and back, drawn by overlaying a page-coloured
     disc on a gold one and sliding it across. */
  return (
    <svg viewBox="0 0 640 80" fill="none" className="w-full">
      {Array.from({ length: 8 }, (_, i) => {
        const cx = 40 + i * 80;
        const offset = (i / 7) * 2 - 1;
        return (
          <g key={cx}>
            <circle cx={cx} cy="40" r="28" fill="currentColor" opacity="0.55" />
            <circle
              cx={cx + offset * 56}
              cy="40"
              r="28"
              fill="var(--page)"
              opacity="0.95"
            />
            <circle
              cx={cx}
              cy="40"
              r="28"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.8"
            />
          </g>
        );
      })}
    </svg>
  );
}

function Ridge() {
  return (
    <svg viewBox="0 0 1440 260" fill="none" className="w-full">
      <path
        d="M0 260V186l120-52 96 34 128-84 112 62 96-40 132 74 108-58 116 44 122-70 118 62 92-30 100 46v86Z"
        fill="currentColor"
        opacity="0.24"
      />
      <path
        d="M0 260V186l120-52 96 34 128-84 112 62 96-40 132 74 108-58 116 44 122-70 118 62 92-30 100 46"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

/* A fixed scatter of pinpricks. The coordinates are hard-coded rather than
   random so the sky is identical in the prerendered HTML and after hydration. */
const STARS = [
  [8, 12, 2.6], [17, 34, 1.5], [26, 8, 1.9], [33, 52, 2.2], [41, 21, 1.4],
  [52, 6, 2.4], [58, 41, 1.6], [64, 15, 2], [71, 57, 1.4], [79, 27, 2.5],
  [86, 9, 1.6], [92, 44, 2.1], [12, 62, 1.8], [23, 78, 2.3], [37, 88, 1.5],
  [47, 68, 2], [61, 82, 1.7], [74, 71, 2.4], [88, 86, 1.5], [95, 63, 2],
];

function Stars() {
  return (
    <div className="absolute inset-0">
      {STARS.map(([left, top, size], i) => (
        <span
          key={`${left}-${top}`}
          className="twinkle absolute rounded-full bg-gold-strong"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDelay: `${(i % 7) * 0.7}s`,
          }}
        />
      ))}
    </div>
  );
}
