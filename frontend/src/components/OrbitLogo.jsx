/**
 * The ORBIT mark: an open ring with a leading arrowhead around a solid core.
 *
 * Rebuilt as vector geometry from the supplied logo so it stays crisp at every
 * size and inherits `currentColor` — the same mark works on the dark marketing
 * page, in the light app shell, and as the favicon.
 *
 * The optical centre is (50, 52), not (50, 50): the arrowhead overhangs the top
 * of the ring, so the body sits slightly low to keep the whole mark balanced in
 * its box. `spinning` rotates about that optical centre, which is what makes the
 * ring read as turning rather than wobbling.
 */
export function OrbitLogo({ className = "h-7 w-7", spinning = false, title }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      className={`${className} ${spinning ? "animate-spin" : ""}`}
      style={spinning ? { transformOrigin: "50% 52%", animationDuration: "1.4s" } : undefined}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path
        d="M68.38 23.69 A33.75 33.75 0 1 1 51.18 18.27"
        stroke="currentColor"
        strokeWidth="9.5"
      />
      <path d="M51.61 6.03 L67.03 18.59 L50.91 26.02 Z" fill="currentColor" />
      <circle cx="50" cy="52" r="14.8" fill="currentColor" />
    </svg>
  );
}

/** Ring only, no core — used as oversized background texture. */
export function OrbitRing({ className = "" }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true" focusable="false">
      <path
        d="M68.38 23.69 A33.75 33.75 0 1 1 51.18 18.27"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M51.61 6.03 L67.03 18.59 L50.91 26.02 Z" fill="currentColor" />
    </svg>
  );
}
