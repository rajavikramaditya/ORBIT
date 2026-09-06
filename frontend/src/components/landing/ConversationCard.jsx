import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Waveform } from "./Waveform";
import { formatDuration } from "./useDemoSession";

/**
 * The hero's conversation surface — one component in two states.
 *
 * Resting, it shows a short sample exchange so a visitor immediately sees what
 * an ORBIT employee actually does. The moment a demo call connects, the same
 * card fills with the real transcript, a live waveform and a running timer, so
 * the thing they were looking at simply comes alive rather than being replaced.
 *
 * The sample is labelled as a sample. Nothing here is dressed up as live data
 * when it isn't (AGENT.md rule 7).
 *
 * The sample PLAYS rather than sitting there. Printed all at once it read as a
 * screenshot pasted into the page — the single most common note on this hero
 * was that it looked stuck. Messages now arrive one at a time, with the agent
 * pausing to think before it answers, and the exchange restarts on a loop, so
 * the first thing a visitor sees is a conversation happening.
 */

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

// Rough speaking rhythm. Deliberately unhurried: a demo that races looks fake,
// and the visitor is reading, not waiting for a machine.
const LEAD_IN_MS = 420;
const TYPING_MS = 1150;      // agent "thinking" before it replies
const AFTER_USER_MS = 900;
const AFTER_AGENT_MS = 2500;
const LOOP_PAUSE_MS = 2200;

/** Reveals `turns` one at a time, then starts over. */
function useSamplePlayback(turns, enabled) {
  const [shownCount, setShownCount] = useState(turns.length);
  const [typing, setTyping] = useState(false);
  // Restart cleanly whenever the sample itself changes (a different vertical).
  const signature = turns.map((t) => t.role + t.text.length).join("|");

  useEffect(() => {
    if (!enabled || REDUCED_MOTION) {
      setShownCount(turns.length);
      setTyping(false);
      return undefined;
    }
    const timers = [];
    const play = () => {
      setTyping(false);
      // Clear just before the first new message lands, not at the top of the
      // cycle — wiping the card and then pausing left an empty box on screen,
      // which is the one thing this animation exists to avoid.
      timers.push(setTimeout(() => setShownCount(0), Math.max(0, LEAD_IN_MS - 220)));
      let at = LEAD_IN_MS;
      turns.forEach((turn, i) => {
        if (turn.role === "agent") {
          timers.push(setTimeout(() => setTyping(true), at));
          at += TYPING_MS;
          timers.push(
            setTimeout(() => {
              setTyping(false);
              setShownCount(i + 1);
            }, at),
          );
          at += AFTER_AGENT_MS;
        } else {
          timers.push(setTimeout(() => setShownCount(i + 1), at));
          at += AFTER_USER_MS;
        }
      });
      timers.push(setTimeout(play, at + LOOP_PAUSE_MS));
    };
    play();
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

  return { shownCount, typing };
}

/** Three dots, the universal "they're about to say something". */
function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22 }}
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3.5"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-orbit-ink/45"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
        />
      ))}
    </motion.div>
  );
}

const SAMPLES = {
  hotel: {
    turns: [
      { role: "user", text: "Do you have a room this Saturday?" },
      {
        role: "agent",
        text: "Yes — a Deluxe King is available Saturday at ₹14,500 plus GST. Shall I hold it for you?",
      },
      { role: "user", text: "Please do." },
    ],
    facts: [["Reading", "Live availability"], ["Action", "Hold room"], ["Channel", "Phone"]],
  },
  restaurant: {
    turns: [
      { role: "user", text: "Table for four tonight, around 8?" },
      {
        role: "agent",
        text: "8pm is open. Any preference — indoor or the terrace? I can note it on the booking.",
      },
      { role: "user", text: "Terrace, please." },
    ],
    facts: [["Reading", "Table availability"], ["Action", "Book table"], ["Channel", "Phone"]],
  },
  clinic: {
    turns: [
      { role: "user", text: "Is Dr. Sharma free this week?" },
      {
        role: "agent",
        text: "Thursday 4:30pm is open. Shall I book that and send you a reminder the day before?",
      },
      { role: "user", text: "Yes, book it." },
    ],
    facts: [["Reading", "Doctor's calendar"], ["Action", "Book slot"], ["Channel", "Phone"]],
  },
};

const FALLBACK = SAMPLES.hotel;

export function ConversationCard({
  scenario,
  live = false,
  connecting = false,
  turns = [],
  seconds = 0,
  getOutputData,
}) {
  const persona = scenario?.persona || "Riya";
  const sample = SAMPLES[scenario?.key] || FALLBACK;

  // Live turns once there are any; otherwise the sample keeps the card populated
  // so it never sits empty while the agent is still connecting.
  const showLive = live && turns.length > 0;
  const source = showLive ? turns : sample.turns;

  // Only the sample animates. A real transcript must appear the instant the
  // agent says it — never on a decorative delay.
  const { shownCount, typing } = useSamplePlayback(sample.turns, !live);
  const shown = showLive ? source : sample.turns.slice(0, shownCount);

  return (
    <motion.div
      layout
      className="relative rounded-[28px] border border-white/20 bg-black/25 p-5 backdrop-blur-md shadow-[0_25px_60px_rgba(0,0,0,0.35)]"
    >
      {/* Header — who is speaking, and the live signal */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-orbit-gold font-display font-semibold text-orbit-ink shadow-sm">
            {persona.charAt(0)}
          </div>
          <div>
            <div className="text-[15px] font-medium text-white">{persona}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-orbit-live">
              {live ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orbit-live opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orbit-live" />
                  </span>
                  {connecting ? "Connecting…" : `On a call · ${formatDuration(seconds)}`}
                </>
              ) : (
                <span className="text-white/60">Sample conversation</span>
              )}
            </div>
          </div>
        </div>
        <Waveform
          getData={getOutputData}
          active={live && !connecting}
          bars={18}
          className="h-7 w-[104px]"
        />
      </div>

      {/* Transcript.
          The fixed min-height stops the card (and the whole hero) from growing
          and shrinking as messages arrive — a jumping page reads as broken. */}
      <div className="min-h-[196px] space-y-3 overflow-y-auto py-5 md:max-h-[240px]">
        <AnimatePresence initial={false}>
          {shown.map((turn, i) => (
            <motion.div
              key={`${turn.role}-${i}-${turn.text.slice(0, 14)}`}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className={
                turn.role === "user"
                  ? "ml-auto w-fit max-w-[75%] rounded-2xl rounded-br-md border border-white/15 bg-white/15 px-4 py-2.5 text-[14px] leading-snug text-white shadow-sm backdrop-blur-sm"
                  : "w-fit max-w-[88%] rounded-2xl rounded-bl-md border border-white/20 bg-white/90 px-4 py-3 text-[14px] leading-snug text-orbit-ink shadow-md backdrop-blur-md"
              }
            >
              {turn.text}
            </motion.div>
          ))}
          {typing && <TypingBubble key="typing" />}
        </AnimatePresence>
      </div>

      {/* What it just did — the part that separates this from a chatbot */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {(showLive
          ? [["Reading", "Your business data"], ["Action", "On confirmation"], ["Channel", "Browser"]]
          : sample.facts
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2.5 backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/60">
              {label}
            </div>
            <div className="mt-0.5 text-[13px] font-medium text-white">{value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
