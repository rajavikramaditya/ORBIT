import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceDemo } from "./VoiceDemo";
import { TranscriptCard } from "./TranscriptCard";
import { SpecCards } from "./SpecCards";
import { DEMO_STATE, useDemoSession } from "./useDemoSession";

const EASE = [0.16, 1, 0.3, 1];

/**
 * The hero, in two states.
 *
 * Resting, it's a headline and the demo pill. The moment a call connects the
 * whole stage re-composes around the conversation: the headline becomes the
 * scenario, a transcript card appears, and fact cards slide in from the right.
 * The background is CSS — layered gradients plus a slow drift — with a video
 * slot ready underneath (drop a file at /hero.webm and it takes over, poster
 * and all, with no code change).
 */
export function HeroStage() {
  const demo = useDemoSession();
  const inCall = demo.state === DEMO_STATE.LIVE || demo.state === DEMO_STATE.STARTING;
  const scenario = demo.activeScenario;

  return (
    <section className="relative isolate min-h-[760px] overflow-hidden bg-orbit-ink lg:min-h-[820px]">
      <HeroBackdrop inCall={inCall} />

      <div className="relative z-10 mx-auto flex min-h-[760px] max-w-7xl flex-col justify-center px-6 pb-20 pt-32 lg:min-h-[820px] lg:px-10 lg:pt-36">
        <AnimatePresence>
          {inCall && (
            <motion.button
              type="button"
              onClick={demo.stop}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-6 top-28 flex items-center gap-2 text-[15px] text-orbit-cream/70 transition-colors hover:text-orbit-cream lg:left-10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </motion.button>
          )}
        </AnimatePresence>

        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left column — headline + demo control */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {inCall && scenario ? (
                <motion.div
                  key="call-copy"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <h1 className="font-display text-[clamp(2.6rem,6vw,4.6rem)] font-semibold leading-[0.94] tracking-[-0.035em] text-orbit-cream">
                    You're talking to
                    <br />
                    <span className="text-orbit-gold">{scenario.persona}</span>, an ORBIT
                    <br />
                    AI employee.
                  </h1>
                  <p className="mt-6 max-w-md text-[17px] leading-relaxed text-orbit-cream/55">
                    {scenario.tagline} Ask her anything a customer would ask.
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
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orbit-live opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orbit-live" />
                    </span>
                    AI employees for real businesses
                  </div>

                  <h1 className="font-display text-[clamp(2.9rem,7vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.04em] text-orbit-cream">
                    Every call
                    <br />
                    answered. Every
                    <br />
                    time.
                  </h1>

                  <p className="mt-7 max-w-lg text-[17px] leading-relaxed text-orbit-cream/55">
                    ORBIT builds an AI employee that knows your business, picks up every
                    phone call and WhatsApp, and books the work — in your brand's voice,
                    around the clock.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div layout className="mt-9 flex flex-wrap items-start gap-4">
              <VoiceDemo demo={demo} />

              <AnimatePresence>
                {!inCall && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    <Link to="/register" data-testid="hero-getstarted">
                      <Button className="h-[54px] rounded-2xl bg-orbit-cream px-7 text-[15px] font-medium text-orbit-ink transition-transform hover:bg-white active:scale-[0.98]">
                        Get started
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {!inCall && (
              <Link
                to="/login"
                data-testid="hero-demo"
                className="mt-6 inline-block text-[15px] text-orbit-cream/45 underline-offset-4 transition-colors hover:text-orbit-cream/80 hover:underline"
              >
                Already with ORBIT? View your dashboard
              </Link>
            )}
          </div>

          {/* Right column — live conversation surface */}
          <div className="relative min-h-[220px] lg:col-span-5">
            <AnimatePresence>
              {inCall && scenario && (
                <motion.div
                  key="call-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-end gap-4"
                >
                  <TranscriptCard
                    turns={demo.turns}
                    personaLabel={scenario.persona}
                    waiting={demo.state === DEMO_STATE.STARTING || !demo.turns.length}
                  />
                  <div className="hidden w-full max-w-[320px] lg:block">
                    <SpecCards scenario={scenario} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Layered CSS backdrop. Two slow-drifting gradient blooms over a deep base,
 * a fine grain overlay, and a vignette so the headline always holds contrast.
 * `orbit-drift` is disabled under prefers-reduced-motion (see index.css).
 *
 * To use footage instead: drop hero.webm + hero-poster.jpg in `public/` and
 * uncomment the <video> below — the gradients stay as the poster/fallback.
 */
function HeroBackdrop({ inCall }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      {/*
      <video
        className="absolute inset-0 h-full w-full object-cover opacity-45"
        src="/hero.webm" poster="/hero-poster.jpg"
        autoPlay loop muted playsInline
      />
      */}
      <div className="absolute inset-0 bg-orbit-ink" />

      <motion.div
        animate={{ opacity: inCall ? 0.5 : 0.32 }}
        transition={{ duration: 1.2 }}
        className="animate-orbit-drift absolute -left-[15%] top-[-30%] h-[820px] w-[820px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.30),transparent_65%)] blur-3xl"
      />
      <motion.div
        animate={{ opacity: inCall ? 0.55 : 0.3 }}
        transition={{ duration: 1.2 }}
        className="animate-orbit-drift-slow absolute -right-[12%] top-[8%] h-[720px] w-[720px] rounded-full bg-[radial-gradient(circle,rgba(74,222,155,0.16),transparent_62%)] blur-3xl"
      />
      <div className="absolute bottom-[-20%] left-[25%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(120,130,255,0.12),transparent_65%)] blur-3xl" />

      <div className="grain absolute inset-0 opacity-[0.55]" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_25%,rgba(8,8,11,0.75)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-orbit-ink" />
    </div>
  );
}
