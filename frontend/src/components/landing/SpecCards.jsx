import { motion } from "framer-motion";

/**
 * Glass fact cards that slide in along the right edge during a live demo.
 *
 * Every line here is a claim ORBIT can actually stand behind, described in
 * ORBIT's own vocabulary. No provider names (AGENT.md rule 4) and no invented
 * numbers — no uptime percentage, no latency figure, no customer count. If a
 * number isn't measured, it isn't shown.
 */
export function SpecCards({ scenario }) {
  const cards = [
    {
      label: "Use case",
      value: scenario.label,
      hint: scenario.tagline,
    },
    {
      label: "Answering as",
      value: scenario.persona,
      hint: scenario.role,
    },
    {
      label: "Channels",
      value: "Phone + WhatsApp",
      hint: "The same employee on every channel your customers use.",
    },
    {
      label: "Data boundary",
      value: "Tenant-isolated",
      hint: "Reads only this business's data. Bookings need confirmation.",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-2.5">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{
            duration: 0.55,
            delay: 0.12 + i * 0.09,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="rounded-2xl border border-white/[0.09] bg-white/[0.05] px-5 py-4 backdrop-blur-2xl"
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-orbit-cream/45">
            {card.label}
          </div>
          <div className="mt-1 font-display text-lg font-semibold tracking-tight text-orbit-cream">
            {card.value}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-orbit-cream/50">
            {card.hint}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
