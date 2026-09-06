import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { VoiceDemo } from "./VoiceDemo";
import { ConversationCard } from "./ConversationCard";
import { VideoLayer } from "./VideoLayer";
import { LANDING_MEDIA } from "./media";
import { DEMO_STATE, useDemoSession } from "./useDemoSession";

const EASE = [0.16, 1, 0.3, 1];

// media.js is meant to be the ONE place video is configured. This file used to
// hard-code its own copy, so edits over there silently did nothing.
const HERO_MEDIA = LANDING_MEDIA.hero;

/**
 * The hero, in two states.
 *
 * Resting: headline, the demo pill, and a sample conversation card on the right.
 * In a call, the same card fills with the live transcript and timer — the thing
 * the visitor was reading simply starts talking back.
 */
export function HeroStage() {
  const demo = useDemoSession();
  const connecting = demo.state === DEMO_STATE.STARTING;
  const inCall = demo.state === DEMO_STATE.LIVE || connecting;
  const scenario = demo.activeScenario;

  return (
    <section className="relative isolate overflow-hidden bg-orbit-ink" style={{ minHeight: 760 }}>
      <HeroBackdrop inCall={inCall} />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-24 lg:grid-cols-12 lg:px-10 lg:pt-16">
        <div className="lg:col-span-6">
          <AnimatePresence>
            {inCall && (
              <motion.button
                type="button"
                onClick={demo.stop}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 flex items-center gap-2 text-[15px] text-white/60 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {inCall && scenario ? (
              <motion.div
                key="call-copy"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <h1
                  className="font-display font-semibold leading-[0.94] tracking-[-0.035em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                  style={{ fontSize: "clamp(2.5rem,4.6vw,4rem)" }}
                >
                  You&rsquo;re talking to{" "}
                  <span className="text-orbit-gold">{scenario.persona}</span>.
                </h1>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.7)]">
                  {scenario.tagline} Ask anything a real customer would ask — she answers the way
                  she would on your phone line.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="rest-copy"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-1.5 text-[13px] text-white/90 backdrop-blur-xl shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-orbit-live" />
                  Built and run for you — not a DIY builder
                </div>

                <h1
                  className="font-display font-semibold leading-[0.92] tracking-[-0.04em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]"
                  style={{ fontSize: "clamp(2.8rem,5.2vw,4.7rem)" }}
                >
                  Every call
                  <br />
                  answered.
                  <br />
                  Every time.
                </h1>

                <p className="mt-7 max-w-md text-[17px] leading-relaxed text-white/85 drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)]">
                  Tell us how your business runs. Our team builds you an AI employee that knows it
                  by heart — then answers every phone call and WhatsApp, day and night.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div layout className="mt-9">
            <VoiceDemo demo={demo} />
          </motion.div>

          {!inCall && (
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
              <Link
                to="/register"
                data-testid="hero-getstarted"
                className="inline-flex items-center gap-1.5 text-orbit-cream transition-opacity hover:opacity-80"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                data-testid="hero-demo"
                className="text-white/55 underline-offset-4 transition-colors hover:text-white/85 hover:underline"
              >
                Already with ORBIT? View your dashboard
              </Link>
            </div>
          )}
        </div>

        <div className="lg:col-span-6">
          <ConversationCard
            scenario={scenario}
            live={inCall}
            connecting={connecting}
            turns={demo.turns}
            seconds={demo.seconds}
            getOutputData={demo.getOutputData}
          />
        </div>
      </div>
    </section>
  );
}

/**
 * Slow-drifting gradient blooms over deep ink, with an optional video layer on
 * top. The blooms always render, so the hero holds up whether or not footage is
 * present. `orbit-drift` is disabled under prefers-reduced-motion (index.css).
 */
function HeroBackdrop({ inCall }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-orbit-ink">
      {/* Full-opacity background video */}
      <VideoLayer media={HERO_MEDIA} className="absolute inset-0 h-full w-full object-cover" />

      {/* Crystal-clear glass scrim: subtle darkening on the left for text contrast,
          fully clear on the right so the video and the card stay vividly visible. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,11,0.68)_0%,rgba(8,8,11,0.38)_40%,rgba(8,8,11,0.08)_70%,transparent_100%)]" />

      {/* Soft edge fades to blend with header and next section */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-orbit-ink/75 via-orbit-ink/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-orbit-ink/80 via-orbit-ink/25 to-transparent" />

      {/* During a live call the background gently dims so the transcript leads. */}
      <motion.div
        animate={{ opacity: inCall ? 0.45 : 0 }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 bg-orbit-ink"
      />
    </div>
  );
}
