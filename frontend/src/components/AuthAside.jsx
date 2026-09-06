import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OrbitLogo } from "@/components/OrbitLogo";

/**
 * The right-hand panel on Sign in and Onboard.
 *
 * It used to be a stock photograph of a hotel lobby. On a page whose whole job
 * is to say "this is ORBIT", a picture of somebody else's reception desk says
 * the opposite — the same note the landing page got: it read as a hotel's site,
 * not as the product's.
 *
 * So this shows the product instead: one exchange, playing. Same ink ground,
 * same gold accent and same message rhythm as the landing hero, so signing in
 * feels like the same building the visitor just walked through.
 */

const EXCHANGE = [
  { role: "user", text: "Do you have a room this Saturday?" },
  { role: "agent", text: "Yes — a Deluxe King at ₹14,500 plus GST. Shall I hold it?" },
  { role: "user", text: "Please hold it." },
];

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

export function AuthAside({ headline, sub, proof }) {
  const [count, setCount] = useState(REDUCED_MOTION ? EXCHANGE.length : 0);

  useEffect(() => {
    if (REDUCED_MOTION) return undefined;
    const timers = [];
    const play = () => {
      timers.push(setTimeout(() => setCount(0), 200));
      let at = 500;
      EXCHANGE.forEach((turn, i) => {
        timers.push(setTimeout(() => setCount(i + 1), at));
        at += turn.role === "agent" ? 2300 : 1100;
      });
      timers.push(setTimeout(play, at + 2000));
    };
    play();
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative hidden overflow-hidden bg-orbit-ink lg:block">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-[-10%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.22),transparent_66%)] blur-3xl"
      />
      {/* The mark, oversized and barely there — brand presence without a logo
          slapped in a corner. OrbitLogo marks itself aria-hidden when it has no
          title, so it stays out of the accessibility tree as decoration. */}
      <OrbitLogo className="pointer-events-none absolute -bottom-24 -left-24 h-[440px] w-[440px] text-white/[0.035]" />

      <div className="relative flex h-full flex-col justify-center px-14 py-16">
        <div className="rounded-[26px] border border-white/12 bg-white/[0.055] p-6 backdrop-blur-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-orbit-gold font-display font-semibold text-orbit-ink">
              R
            </div>
            <div>
              <div className="text-[15px] font-medium text-white">Riya</div>
              <div className="text-[12px] text-white/45">Sample conversation</div>
            </div>
          </div>

          <div className="min-h-[168px] space-y-3 py-5">
            <AnimatePresence initial={false}>
              {EXCHANGE.slice(0, count).map((turn, i) => (
                <motion.div
                  key={`${turn.role}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className={
                    turn.role === "user"
                      ? "ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-white/[0.13] px-4 py-2.5 text-[14px] leading-snug text-white/85"
                      : "w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[14px] leading-snug text-orbit-ink"
                  }
                >
                  {turn.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <p className="mt-10 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-white">
          {headline}
        </p>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/55">{sub}</p>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/40">
          {proof.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
