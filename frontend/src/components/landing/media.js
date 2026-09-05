/**
 * ── ALL LANDING-PAGE VIDEO IN ONE PLACE ────────────────────────────────────
 *
 * This is the only file you edit to add, change or remove a video. Nothing
 * else in the codebase needs touching.
 *
 * To add a video:
 *   1. Put the file in  frontend/public/   (e.g. frontend/public/hero.mp4)
 *   2. Set `src` below to "/hero.mp4"      (the leading slash means public/)
 *   3. Commit and push.
 *
 * To change it later: replace the file in public/ with the same name. Done.
 * To remove it:       set `src` back to null.
 *
 * If a file is missing or fails to play, that layer hides itself and the
 * gradient behind it carries the section — the page never looks broken.
 *
 * A NOTE ON WEIGHT. Every video is bandwidth a visitor pays for before they
 * read a word. Download the HD (1920×1080) version, not 4K, and keep each
 * file under ~5 MB. One video is a good landing page; four is a slow one.
 */
export const LANDING_MEDIA = {
  /**
   * HERO — the big one, behind the headline. Worth it: it is the first
   * impression and sits above the fold. Recommended.
   * `opacity` fades it under the scrim — lower if the headline gets hard to read.
   */
  hero: {
    src: "/hero.mp4",
    poster: null, // "/hero-poster.jpg" — shows while the video loads
    opacity: 0.42,
  },

  /**
   * DASHBOARD — plays inside the browser frame in "You watch the outcomes".
   *
   * This is the most valuable video on the page, and it is not stock footage:
   * a screen recording of the REAL ORBIT dashboard. Nothing sells a product
   * like watching it work. Until you have one, the built-in mock is used.
   *
   * Record at 1440×900 or 1920×1200, no cursor jitter, 10–20 seconds, loop-friendly.
   * Only ever record a demo tenant — never a real customer's data on a public page.
   */
  dashboard: {
    src: null, // "/dashboard.mp4"
    poster: null,
  },

  /**
   * CTA — behind "Tell us how your business runs" at the bottom.
   * Optional. Reusing the hero file here ("/hero.mp4") costs nothing extra,
   * because the browser has already downloaded and cached it.
   */
  cta: {
    src: null, // "/hero.mp4" to reuse, or its own file
    poster: null,
    opacity: 0.3,
  },

  /**
   * "ONE ORDINARY DAY" band — deliberately left with no slot.
   *
   * That section is a dense text timeline; footage behind it would fight the
   * reading and add weight for nothing. If you ever want it, copy the `cta`
   * pattern — but the honest answer is that it belongs without one.
   */
};
