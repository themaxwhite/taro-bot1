import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A soft, evolving ambient pad — synthesized entirely with the Web Audio
 * API rather than an audio file. Three detuned oscillators around a
 * minor chord, run through a slow-sweeping lowpass filter for gentle
 * movement, at a very low master volume (background texture, not music).
 *
 * Browsers block audio autoplay without a user gesture, so this always
 * starts off and only ever turns on from an explicit toggle click —
 * there's no "remember last session" here on purpose, since silently
 * trying to resume audio without a fresh gesture just fails in most
 * browsers anyway.
 */
export function useAmbientSound() {
  const [enabled, setEnabled] = useState(false);
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    oscillators: OscillatorNode[];
  } | null>(null);

  const start = useCallback(() => {
    if (audioRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 2);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    // Slow filter sweep for a subtle "breathing" quality.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.03;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    filter.connect(master);
    master.connect(ctx.destination);

    // A minor-ish open chord (A2, E3, C4) — three gently detuned sines.
    const freqs = [110, 164.81, 261.63];
    const oscillators = freqs.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = i === 0 ? -4 : i === 1 ? 3 : -2;
      const oscGain = ctx.createGain();
      oscGain.gain.value = i === 0 ? 0.6 : 0.35;
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      return osc;
    });

    audioRef.current = { ctx, master, oscillators };
  }, []);

  const stop = useCallback(() => {
    const current = audioRef.current;
    if (!current) return;
    const { ctx, master, oscillators } = current;
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    setTimeout(() => {
      oscillators.forEach((osc) => osc.stop());
      ctx.close();
    }, 900);
    audioRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) start();
      else stop();
      return next;
    });
  }, [start, stop]);

  // Stop cleanly if the component using this hook unmounts mid-playback.
  useEffect(() => stop, [stop]);

  return { enabled, toggle };
}
