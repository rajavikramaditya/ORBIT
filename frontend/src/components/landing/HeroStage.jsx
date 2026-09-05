import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { VoiceDemo } from "./VoiceDemo";
import { ConversationCard } from "./ConversationCard";
import { DEMO_STATE, useDemoSession } from "./useDemoSession";

const EASE = [0.16, 1, 0.3, 1];

/**
 * ── Hero background media ──────────────────────────────────────────────────
 * To use footage: drop the file in `frontend/public/` and point `src` at it.
 * To change it later, swap the file (or edit this one line) — nothing else in
 * the codebase needs touching. Set `src: null` for the animated backdrop alone.
 *
 * Free hotel/reception footage: pexels.com (search "hotel receptionist
 * telephone"). Download the HD mp4 and save it as public/hero.mp4.
 *
 * If the file is missing or fails to decode, the video hides itself and the
 * gradient backdrop underneath carries the hero — the page never looks broken.
 */
const HERO_MEDIA = {
  src: null, // e.g. "/hero.mp4"
  poster: null, // e.g. "/hero-poster.jpg"
  opacity: 0.42,
};

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
    <section className="relative isolate overflow-hidden bg-orbit-ink" style={{ minHeight: 840 }}>
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
                className="mb-6 flex items-center gap-2 text-[15px] text-orbit-cream/60 transition-colors hover:text-orbit-cream"
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
                  className="font-display font-semibold leading-[0.94] tracking-[-0.035em] text-orbit-cream"
                  style={{ fontSize: "clamp(2.5rem,4.6vw,4rem)" }}
                >
                  You&rsquo;re talking to{" "}
                  <span className="text-orbit-gold">{scenario.persona}</span>.
                </h1>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-orbit-cream/55">
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
                <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-orbit-cream/60 backdrop-blur-xl">
                  <span className="h-1.5 w-1.5 rounded-full bg-orbit-live" />
                  Built and run for you — not a DIY builder
                </div>

                <h1
                  className="font-display font-semibold leading-[0.92] tracking-[-0.04em] text-orbit-cream"
                  style={{ fontSize: "clamp(2.8rem,5.2vw,4.7rem)" }}
                >
                  Every call
                  <br />
                  answered.
                  <br />
                  Every time.
                </h1>

                <p className="mt-7 max-w-md text-[17px] leading-relaxed text-orbit-cream/55">
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
                className="text-orbit-cream/45 underline-offset-4 transition-colors hover:text-orbit-cream/75 hover:underline"
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
  const [videoFailed, setVideoFailed] = useState(false);
  const showVideo = Boolean(HERO_MEDIA.src) && !videoFailed;

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="animate-orbit-drift absolute -left-[14%] top-[-28%] h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.30),transparent_65%)] blur-3xl" />
      <div className="animate-orbit-drift-slow absolute -right-[10%] top-[4%] h-[760px] w-[760px] rounded-full bg-[radial-gradient(circle,rgba(120,140,255,0.16),transparent_62%)] blur-3xl" />
      <div className="absolute bottom-[-24%] left-[28%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(47,163,107,0.14),transparent_65%)] blur-3xl" />

      {showVideo && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: HERO_MEDIA.opacity }}
          src={HERO_MEDIA.src}
          poster={HERO_MEDIA.poster || undefined}
          onError={() => setVideoFailed(true)}
          autoPlay
          loop
          muted
          playsInline
        />
      )}

      <motion.div
        animate={{ opacity: inCall ? 0.35 : 0 }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 bg-orbit-ink"
      />
      <div className="grain absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_30%,rgba(8,8,11,0.8)_100%)]" />
    </div>
  );
}
