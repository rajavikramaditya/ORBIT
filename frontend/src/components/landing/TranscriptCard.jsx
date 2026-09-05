import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * The floating transcript card in the hero during a live demo call.
 *
 * Warm cream on a dark stage: it should read as a spoken line, not a chat log.
 * Only the last few turns are kept so the card never grows into a wall of text
 * over the hero — the full transcript belongs in the dashboard, not here.
 */
export function TranscriptCard({ turns, personaLabel, waiting }) {
  const scrollRef = useRef(null);
  const last = turns[turns.length - 1];
  const lastText = last ? last.text : "";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, lastText]);

  const speaker = last?.role === "user" ? "You" : personaLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[400px] rounded-2xl bg-[#F4F1EA] px-5 py-4 text-[#15151A] shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
      aria-live="polite"
      aria-atomic="false"
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#15151A]/45">
        {speaker}
      </div>

      {waiting && !turns.length ? (
        <div className="mt-2.5 flex items-center gap-1.5" aria-label="Connecting">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-1.5 w-1.5 rounded-full bg-[#15151A]/35"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
            />
          ))}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="mt-2 max-h-[132px] space-y-2 overflow-y-auto text-[15px] leading-snug"
        >
          {turns.map((turn, i) => (
            <p
              key={`${turn.role}-${i}`}
              className={
                i === turns.length - 1
                  ? "text-[#15151A]"
                  : "text-[#15151A]/45"
              }
            >
              {turn.text}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
