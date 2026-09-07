import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * A small "spatial UI" primitive: the card tilts in 3D toward the cursor,
 * like it has real depth sitting slightly off the page, then springs flat
 * when the pointer leaves. Used across the site (How it works, Security,
 * Channels, the dashboard preview) so the premium feel is consistent rather
 * than a one-off effect on a single section.
 *
 * Pointer-driven only — on touch it simply never receives a mousemove, so it
 * degrades to a normal static card with no extra code path needed. Reduced
 * motion turns it off outright.
 */
const REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export function TiltCard({ children, className = "", maxTilt = 7, lift = true }) {
  const ref = useRef(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springCfg = { stiffness: 260, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), springCfg);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), springCfg);
  const scale = useSpring(1, springCfg);
  const glowX = useTransform(px, [0, 1], ["0%", "100%"]);
  const glowY = useTransform(py, [0, 1], ["0%", "100%"]);
  const glowBg = useTransform(
    [glowX, glowY],
    ([gx, gy]) =>
      `radial-gradient(320px circle at ${gx} ${gy}, rgba(228,184,113,0.14), transparent 70%)`
  );

  if (REDUCED_MOTION) {
    return <div className={className}>{children}</div>;
  }

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };
  const handleEnter = () => {
    if (lift) scale.set(1.015);
  };
  const handleLeave = () => {
    px.set(0.5);
    py.set(0.5);
    scale.set(1);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, scale, transformPerspective: 900 }}
      className={`group relative ${className}`}
    >
      {/* A soft light that tracks the cursor — the cue that sells the tilt as
          a lit, physical surface rather than just a CSS transform. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: glowBg }}
      />
      {children}
    </motion.div>
  );
}
