import { useEffect, useRef } from "react";

/**
 * Live audio bars for the landing-page voice demo.
 *
 * Driven by a `getData` callback that returns a Uint8Array of frequency data
 * (or null when the session hasn't produced audio yet). Everything is drawn on
 * a canvas inside one requestAnimationFrame loop so the bars never trigger
 * React re-renders — at 60fps that would swamp the page.
 *
 * When there is no data the bars settle into a slow idle breath rather than
 * flatlining, so a silent moment still reads as "connected and listening".
 */
export function Waveform({ getData, bars = 22, className = "", active = true }) {
  const canvasRef = useRef(null);
  const getDataRef = useRef(getData);
  const levelsRef = useRef(new Array(bars).fill(0));

  // Keep the latest callback without restarting the animation loop.
  getDataRef.current = getData;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let frame;
    let disposed = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (time) => {
      if (disposed) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (width && height) {
        ctx.clearRect(0, 0, width, height);

        let data = null;
        try {
          data = active ? getDataRef.current?.() : null;
        } catch {
          // The SDK throws if the session ended between frames — idle instead.
          data = null;
        }

        const levels = levelsRef.current;
        const gap = 2;
        const barWidth = Math.max(1.5, (width - gap * (bars - 1)) / bars);

        for (let i = 0; i < bars; i += 1) {
          let target;
          if (data && data.length) {
            // Sample the low/mid range — that's where speech energy lives.
            const idx = Math.floor((i / bars) * Math.min(data.length, 48));
            target = (data[idx] || 0) / 255;
          } else if (reduced) {
            // Static but shaped, so it still reads as a waveform rather than a rule.
            target = 0.25 + 0.2 * Math.abs(Math.sin(i * 0.9));
          } else {
            // Idle: a travelling wave with real amplitude. Two offset sines keep
            // it from looking like a metronome. This has to be clearly alive —
            // a low-amplitude ripple just reads as a row of static dots.
            const t = time / 430;
            target =
              0.22 +
              0.34 * Math.abs(Math.sin(t + i * 0.55)) +
              0.16 * Math.abs(Math.sin(t * 0.6 + i * 0.23));
          }
          // Ease toward the target so loud syllables don't strobe.
          levels[i] += (target - levels[i]) * 0.3;

          const h = Math.max(2, levels[i] * height * 0.92);
          const x = i * (barWidth + gap);
          const y = (height - h) / 2;
          const alpha = 0.35 + levels[i] * 0.65;
          ctx.fillStyle = `rgba(244, 241, 234, ${alpha.toFixed(3)})`;
          if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, h, barWidth / 2);
            ctx.fill();
          } else {
            // Older Safari: square bars beat a thrown error inside a rAF loop.
            ctx.fillRect(x, y, barWidth, h);
          }
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [bars, active]);

  // A caller-supplied size wins; the default suits a small inline waveform.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className || "h-4 w-[92px]"}
    />
  );
}
