/**
 * The shared shell language for every page behind the login.
 *
 * The problem this exists to fix: the landing page and the product were built
 * on two different design systems. Measured across the app — the landing uses
 * ORBIT's tokens 112 times and never touches Tailwind's `zinc` scale; the pages
 * inside used `zinc` 358 times and ORBIT's tokens zero times, with the gold
 * accent appearing not once. Page titles came in three different sizes, and the
 * same white card was hand-written 29 times with slightly different padding.
 *
 * That is why the inside felt like a cheaper product than the front door. These
 * primitives are the one place that language now lives.
 */
import { Loader2 } from "lucide-react";

/**
 * The top of every page: gold eyebrow, one title size, one subtitle size.
 *
 * The eyebrow is the single detail that carries the landing's identity inside —
 * it is the only warm colour in the app shell, and it appears in exactly one
 * role, which is what keeps it feeling deliberate rather than decorative.
 */
export function PageHeader({ eyebrow, title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orbit-goldink">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.035em] text-orbit-text">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-orbit-text/55">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled block inside a page — one step down from PageHeader. */
export function SectionTitle({ children, hint, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-orbit-text">
          {children}
        </h2>
        {hint && <p className="mt-1 text-[13px] text-orbit-text/50">{hint}</p>}
      </div>
      {actions}
    </div>
  );
}

/**
 * The one card.
 *
 * `flush` drops the padding for cards that hold their own header row and a
 * divided list — otherwise every list ended up double-padded.
 */
export function Card({ children, className = "", flush = false, ...rest }) {
  return (
    <div
      className={`rounded-[22px] border border-black/[0.06] bg-white ${
        flush ? "" : "p-6"
      } shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Header strip for a `flush` Card. */
export function CardHeader({ children, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * A number that matters.
 *
 * `emphasis` lifts one tile out of the row — five identical grey tiles say
 * nothing about which figure the owner should actually look at.
 */
export function StatTile({ icon: Icon, label, value, hint, emphasis = false, testid }) {
  return (
    <div
      data-testid={testid}
      className={`rounded-[18px] border p-5 transition-colors ${
        emphasis
          ? "border-transparent bg-orbit-text text-white"
          : "border-black/[0.06] bg-white"
      }`}
    >
      {Icon && (
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            emphasis ? "bg-white/10 text-white" : "bg-orbit-sand text-orbit-text/70"
          }`}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </span>
      )}
      <div
        className={`mt-4 font-display text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums ${
          emphasis ? "text-white" : "text-orbit-text"
        }`}
      >
        {value}
      </div>
      <div className={`mt-1.5 text-[13px] ${emphasis ? "text-white/60" : "text-orbit-text/50"}`}>
        {label}
      </div>
      {hint && (
        <div className={`mt-0.5 text-[12px] ${emphasis ? "text-white/45" : "text-orbit-text/35"}`}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * The explanatory note that appears at the top of several pages.
 *
 * These were `bg-blue-50` boxes — a blue that exists nowhere else in ORBIT and
 * belongs to no part of the brand. Same job, in the product's own colours.
 */
export function InfoNote({ icon: Icon, children, tone = "neutral" }) {
  const tones = {
    neutral: "border-black/[0.06] bg-orbit-sand text-orbit-text/70",
    gold: "border-orbit-gold/30 bg-orbit-gold/[0.09] text-orbit-goldink",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={`flex items-start gap-3 rounded-[18px] border px-5 py-4 ${tones[tone] || tones.neutral}`}>
      {Icon && <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />}
      <div className="text-[14px] leading-relaxed">{children}</div>
    </div>
  );
}

/** Empty state for a list that legitimately has nothing in it yet. */
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-orbit-sand text-orbit-text/40">
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </span>
      )}
      <div className="font-display text-[16px] font-semibold text-orbit-text">{title}</div>
      {children && (
        <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-orbit-text/50">{children}</p>
      )}
    </div>
  );
}

/** Inline spinner used inside cards and buttons. */
export function Spinner({ className = "h-5 w-5" }) {
  return <Loader2 className={`${className} animate-spin text-orbit-text/25`} />;
}
