import { useState } from "react";

/**
 * A background video that fails quietly.
 *
 * If `src` is null (no video configured) or the file 404s / can't decode, this
 * renders nothing at all and whatever sits behind it — a gradient, the dashboard
 * mock — carries the section. That is the whole point: the page must look
 * finished whether or not anyone has dropped a file into public/ yet.
 *
 * Every slot is configured in media.js; no section hard-codes a path.
 */
export function VideoLayer({ media, className = "", style, ...rest }) {
  const [failed, setFailed] = useState(false);

  if (!media?.src || failed) return null;

  return (
    <video
      className={className}
      style={{ opacity: media.opacity ?? 1, ...style }}
      src={media.src}
      poster={media.poster || undefined}
      onError={() => setFailed(true)}
      autoPlay
      loop
      muted
      playsInline
      // Background video is decoration — never announce it, never let it take focus.
      aria-hidden="true"
      tabIndex={-1}
      {...rest}
    />
  );
}
