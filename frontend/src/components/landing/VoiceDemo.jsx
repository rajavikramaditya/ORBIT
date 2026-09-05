import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AlertCircle, Phone, PhoneOff, Play } from "lucide-react";
import { ScenarioSelect } from "./ScenarioSelect";
import { OrbitLogo } from "@/components/OrbitLogo";
import { Waveform } from "./Waveform";
import { DEMO_STATE, formatDuration } from "./useDemoSession";

/**
 * The hero's demo control: one glass pill in the idle state, a compact call
 * cluster while live.
 *
 * It renders something useful in every state — including the ones where no
 * demo exists. If the server has no scenario configured, or the API can't be
 * reached, the pill is replaced by a plain "Book a live demo" link rather than
 * a control that would fail when pressed.
 */
export function VoiceDemo({ demo }) {
  const {
    state,
    scenarios,
    scenarioKey,
    setScenarioKey,
    activeScenario,
    seconds,
    errorMessage,
    start,
    stop,
    dismissError,
    getOutputData,
  } = demo;

  if (state === DEMO_STATE.LOADING) {
    return (
      <div className="h-[54px] w-full max-w-[460px] animate-pulse rounded-2xl bg-white/[0.06]" />
    );
  }

  if (state === DEMO_STATE.UNAVAILABLE) {
    return (
      <Link
        to="/register"
        data-testid="demo-unavailable-cta"
        className="inline-flex h-[54px] items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-6 text-[15px] font-medium text-orbit-cream backdrop-blur-2xl transition-colors hover:bg-white/[0.11]"
      >
        <Phone className="h-4 w-4" />
        Book a live demo
      </Link>
    );
  }

  if (state === DEMO_STATE.LIVE || state === DEMO_STATE.STARTING) {
    const connecting = state === DEMO_STATE.STARTING;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          type="button"
          onClick={stop}
          data-testid="demo-end"
          aria-label="End the demo call"
          className="grid h-[54px] w-[54px] place-items-center rounded-full border border-white/15 bg-white/[0.08] text-orbit-cream backdrop-blur-2xl transition-colors hover:border-red-400/40 hover:bg-red-500/20"
        >
          <PhoneOff className="h-[18px] w-[18px]" />
        </button>

        <div className="flex h-[54px] items-center gap-3.5 rounded-2xl border border-white/10 bg-black/35 px-5 backdrop-blur-2xl">
          {connecting ? (
            <>
              {/* The mark itself is the spinner — the ring is already a rotation. */}
              <OrbitLogo spinning className="h-[18px] w-[18px] text-orbit-cream/60" />
              <span className="text-[15px] text-orbit-cream/70">Connecting…</span>
            </>
          ) : (
            <>
              <Waveform getData={getOutputData} />
              <span className="font-mono text-[15px] tabular-nums text-orbit-cream/80">
                {formatDuration(seconds)}
              </span>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full max-w-[460px]">
      <motion.div
        layout
        className="flex h-[54px] items-stretch overflow-hidden rounded-2xl border border-white/10 bg-black/35 backdrop-blur-2xl max-[700px]:h-auto max-[700px]:flex-col"
      >
        <ScenarioSelect
          scenarios={scenarios}
          value={scenarioKey}
          onChange={setScenarioKey}
          disabled={state === DEMO_STATE.ERROR}
        />

        <div className="w-px bg-white/10 max-[700px]:h-px max-[700px]:w-full" />

        <button
          type="button"
          onClick={state === DEMO_STATE.ERROR ? dismissError : start}
          data-testid="demo-start"
          className="flex shrink-0 items-center justify-center gap-2 px-6 text-[15px] font-medium text-orbit-cream outline-none transition-colors hover:bg-white/[0.12] focus-visible:bg-white/[0.12] max-[700px]:h-[52px] max-[700px]:w-full"
        >
          {state === DEMO_STATE.ERROR ? (
            "Try again"
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Talk to {activeScenario?.persona ?? "our AI"}
            </>
          )}
        </button>
      </motion.div>

      <div className="mt-3 min-h-[20px] px-1">
        <AnimatePresence mode="wait">
          {errorMessage ? (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex items-center gap-1.5 text-[13px] text-amber-300/90"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMessage}
            </motion.p>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[13px] text-orbit-cream/40"
            >
              Talks back in your browser — no phone call needed.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
