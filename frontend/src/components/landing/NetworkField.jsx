import { useEffect, useRef } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const MAX_LINK_DIST = 130;
const MOUSE_DIST = 170;
const MOUSE_PULL = 0.018;
const DRAG = 0.96;

/**
 * A quiet constellation behind a light section — nodes drifting on their
 * own, linked to whatever is nearby, with the cursor joining the mesh as
 * one more point that gently pulls the nearest nodes toward it. The
 * "satellite network" look a plain white section was missing.
 *
 * This is canvas, not CSS. A mesh that has to recompute its own edges every
 * frame and react to the cursor isn't something a gradient or a border
 * trick can do — and unlike the mask-composite ring earlier in this file,
 * a 2D canvas path draws identically in every browser, so there's no
 * silent-failure risk here the way there was with that technique.
 *
 * Sized to its parent element (which must be `position: relative` or
 * `absolute` and non-zero size) rather than the viewport, so the same
 * component drops into any section unchanged. Pauses itself via
 * IntersectionObserver while off-screen, and never animates or listens for
 * the cursor at all under prefers-reduced-motion — it just draws one still
 * frame.
 */
export function NetworkField({ color = "138,106,47" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nodes = [];
    let raf = null;
    let running = false;
    const mouse = { x: -9999, y: -9999, active: false };

    const seed = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deliberately sparse — a dense mesh reads as noise, not signal.
      const count = Math.max(14, Math.min(46, Math.round((width * height) / 22000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      nodes.forEach((n) => {
        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_DIST && d > 0.01) {
            n.vx += (dx / d) * MOUSE_PULL;
            n.vy += (dy / d) * MOUSE_PULL;
          }
        }
        n.vx *= DRAG;
        n.vy *= DRAG;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        n.x = Math.min(Math.max(n.x, 0), width);
        n.y = Math.min(Math.max(n.y, 0), height);
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d < MAX_LINK_DIST) {
            const a = (1 - d / MAX_LINK_DIST) * 0.28;
            ctx.strokeStyle = `rgba(${color},${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${color},0.62)`;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (mouse.active) {
        nodes.forEach((n) => {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_DIST) {
            const a = (1 - d / MOUSE_DIST) * 0.4;
            ctx.strokeStyle = `rgba(${color},${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        });
      }
    };

    const step = () => {
      draw();
      raf = requestAnimationFrame(step);
    };
    const start = () => {
      if (running || REDUCED_MOTION) return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    };

    seed();
    if (REDUCED_MOTION) {
      draw();
      return undefined;
    }
    start();

    const onMove = (e) => {
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouse.x = x;
      mouse.y = y;
      mouse.active = x >= 0 && x <= width && y >= 0 && y <= height;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    const onResize = () => seed();

    // The wrapper this canvas lives in is pointer-events-none (it must stay
    // out of the way of real content), so a listener on it would never
    // fire — the cursor is tracked from the window instead and clipped to
    // this element's own bounds above.
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave, { passive: true });
    window.addEventListener("resize", onResize);

    const io = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.01 },
    );
    io.observe(parent);

    return () => {
      stop();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", onResize);
      io.disconnect();
    };
  }, [color]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
