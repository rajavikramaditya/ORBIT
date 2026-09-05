import { motion } from "framer-motion";
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
 */

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
  const shown = showLive ? turns : sample.turns;

  return (
    <motion.div
      layout
      className="relative rounded-[28px] border border-white/12 bg-white/[0.055] p-5 backdrop-blur-2xl"
      style={{ boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}
    >
      {/* A slow warm breath behind the card — the difference between "a screenshot
          of a product" and "a product that is running". */}
      <div
        aria-hidden="true"
        className="animate-orbit-breathe pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-[radial-gradient(circle,rgba(228,184,113,0.28),transparent_68%)] blur-2xl"
      />
      {/* Header — who is speaking, and the live signal */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-orbit-gold font-display font-semibold text-orbit-ink">
            {persona.charAt(0)}
          </div>
          <div>
            <div className="text-[15px] font-medium text-orbit-cream">{persona}</div>
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
                <span className="text-orbit-cream/35">Sample conversation</span>
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

      {/* Transcript */}
      <div className="max-h-[220px] space-y-3 overflow-y-auto py-5">
        {shown.map((turn, i) => (
          <div
            key={`${turn.role}-${i}-${turn.text.slice(0, 12)}`}
            className={
              turn.role === "user"
                ? "ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-[14px] leading-snug text-orbit-cream/75"
                : "max-w-[88%] rounded-2xl rounded-bl-md bg-orbit-cream px-4 py-3 text-[14px] leading-snug text-orbit-ink"
            }
          >
            {turn.text}
          </div>
        ))}
      </div>

      {/* What it just did — the part that separates this from a chatbot */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {(showLive
          ? [["Reading", "Your business data"], ["Action", "On confirmation"], ["Channel", "Browser"]]
          : sample.facts
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.05] px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-orbit-cream/35">
              {label}
            </div>
            <div className="mt-0.5 text-[13px] text-orbit-cream">{value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
