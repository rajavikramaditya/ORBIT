import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, MessageCircle, Languages, Check } from "lucide-react";

/**
 * "An employee built for your line of work", as something to watch.
 *
 * This replaces four static cards stacked two-by-two. Nobody read them: a
 * visitor arrives knowing which business they run, and four boxes ask them to
 * scan all four to find it. Here they pick their own line of work and watch
 * that employee take a call — one exchange, playing, with the capabilities
 * that made the answer possible listed beside it.
 *
 * It also advances on its own every few seconds until the visitor picks a tab,
 * so an idle page keeps moving. Once they choose, it stays where they put it —
 * an interface that keeps sliding out from under a reader is worse than a
 * static one.
 */

export const VERTICALS = [
  {
    key: "hotel",
    tab: "Hotel",
    initial: "R",
    name: "Riya",
    role: "AI Reservation Assistant",
    turns: [
      { role: "user", text: "Do you have a room this Saturday?" },
      {
        role: "agent",
        text: "Yes — a Deluxe King is free on Saturday at ₹14,500 plus GST. Shall I hold it for you?",
      },
      { role: "user", text: "Please hold it." },
      { role: "agent", text: "Held under your number. I've sent the confirmation on WhatsApp." },
    ],
    caps: ["Checks live availability", "Takes the booking", "Answers amenities", "Sends confirmation"],
    reading: "Live availability",
    action: "Hold room",
  },
  {
    key: "restaurant",
    tab: "Restaurant",
    initial: "A",
    name: "Aarav",
    role: "AI Booking & Order Assistant",
    turns: [
      { role: "user", text: "Table for four tonight, around 8?" },
      { role: "agent", text: "8pm is open. Indoor or the terrace? I'll note it on the booking." },
      { role: "user", text: "Terrace, please." },
      { role: "agent", text: "Done — terrace table for four at 8pm, under your name." },
    ],
    caps: ["Table reservations", "Takes orders", "Today's specials", "Timings & directions"],
    reading: "Table availability",
    action: "Book table",
  },
  {
    key: "clinic",
    tab: "Clinic",
    initial: "A",
    name: "Ananya",
    role: "AI Appointment Assistant",
    turns: [
      { role: "user", text: "Is Dr. Sharma free this week?" },
      { role: "agent", text: "Thursday 4:30pm is open. Shall I book it and remind you the day before?" },
      { role: "user", text: "Yes, book it." },
      { role: "agent", text: "Booked. You'll get a reminder on Wednesday evening." },
    ],
    caps: ["Books appointments", "Sends reminders", "Doctor availability", "Patient queries"],
    reading: "Doctor's calendar",
    action: "Book slot",
  },
  {
    key: "realestate",
    tab: "Real estate",
    initial: "K",
    name: "Kabir",
    role: "AI Property Advisor",
    turns: [
      { role: "user", text: "What's the price on the 3BHK in Vaishali Nagar?" },
      { role: "agent", text: "That one is ₹1.4 Cr, 1,850 sq ft, east facing. Would you like a site visit?" },
      { role: "user", text: "This weekend works." },
      { role: "agent", text: "Saturday 11am noted. Our team will confirm and call you back." },
    ],
    caps: ["Captures leads", "Property details", "Schedules site visits", "Qualifies buyers"],
    reading: "Live inventory",
    action: "Log site visit",
  },
];

const AUTO_ADVANCE_MS = 7000;
const REDUCED_MOTION =
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** Plays one vertical's exchange, message by message. */
function useTurnPlayback(turns) {
  const [count, setCount] = useState(REDUCED_MOTION ? turns.length : 0);
  const signature = turns.map((t) => t.text.length).join("|");

  useEffect(() => {
    if (REDUCED_MOTION) {
      setCount(turns.length);
      return undefined;
    }
    setCount(0);
    const timers = turns.map((turn, i) =>
      setTimeout(() => setCount(i + 1), 420 + i * (turn.role === "agent" ? 1250 : 950)),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return count;
}

export function VerticalShowcase() {
  const [index, setIndex] = useState(0);
  const [pinned, setPinned] = useState(false);
  const active = VERTICALS[index];
  const shownCount = useTurnPlayback(active.turns);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  useEffect(() => {
    if (REDUCED_MOTION) return undefined;
    const id = setInterval(() => {
      if (pinnedRef.current) return;
      setIndex((i) => (i + 1) % VERTICALS.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(id);
  }, []);

  const choose = (i) => {
    setIndex(i);
    setPinned(true);
  };

  return (
    <div data-testid="vertical-showcase">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose your line of work">
        {VERTICALS.map((v, i) => {
          const on = i === index;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => choose(i)}
              data-testid={`vertical-tab-${v.key}`}
              className={`relative rounded-full px-5 py-2.5 text-[15px] transition-colors ${
                on ? "text-white" : "text-orbit-text/55 hover:text-orbit-text"
              }`}
            >
              {on && (
                <motion.span
                  layoutId="vertical-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className="absolute inset-0 -z-10 rounded-full bg-orbit-text"
                />
              )}
              {v.tab}
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-12">
        {/* The call */}
        <div className="relative overflow-hidden rounded-[26px] bg-orbit-ink p-6 sm:p-8 lg:col-span-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.22),transparent_68%)] blur-3xl"
          />
          <div className="relative flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-orbit-gold font-display font-semibold text-orbit-ink">
              {active.initial}
            </div>
            <div>
              <div className="font-display text-[17px] font-semibold text-white">{active.name}</div>
              <div className="text-[13px] text-white/45">{active.role}</div>
            </div>
            <span className="ml-auto rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.13em] text-white/50">
              {active.tab}
            </span>
          </div>

          <div className="relative min-h-[268px] space-y-3 py-6">
            <AnimatePresence initial={false} mode="popLayout">
              {active.turns.slice(0, shownCount).map((turn, i) => (
                <motion.div
                  key={`${active.key}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  className={
                    turn.role === "user"
                      ? "ml-auto w-fit max-w-[78%] rounded-2xl rounded-br-md bg-white/[0.13] px-4 py-2.5 text-[14px] leading-snug text-white/85"
                      : "w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[14px] leading-snug text-orbit-ink"
                  }
                >
                  {turn.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="relative grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
            {[
              ["Reading", active.reading],
              ["Action", active.action],
              ["Channel", "Phone"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/[0.05] px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</div>
                <div className="mt-0.5 text-[13px] text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* What made that answer possible */}
        <div className="rounded-[26px] border border-black/[0.07] bg-white p-6 sm:p-8 lg:col-span-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-orbit-goldink">
            What {active.name} can do
          </div>
          <ul className="mt-6 space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {active.caps.map((cap) => (
                  <li key={cap} className="flex items-start gap-3 text-[15px] text-orbit-text/80">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orbit-text text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {cap}
                  </li>
                ))}
              </motion.div>
            </AnimatePresence>
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-black/[0.07] pt-5 text-[13px] text-orbit-text/50">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Phone
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" /> Hindi + English
            </span>
          </div>

          <p className="mt-6 text-[14px] leading-relaxed text-orbit-text/55">
            Not on this list? Tell us how your business answers its phone and we build the employee
            for it — the work is the same either way.
          </p>
        </div>
      </div>
    </div>
  );
}
