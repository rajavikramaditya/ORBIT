import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceDemo } from "./VoiceDemo";
import { TranscriptCard } from "./TranscriptCard";
import { SpecCards } from "./SpecCards";
import { DEMO_STATE, useDemoSession } from "./useDemoSession";

const EASE = [0.16, 1, 0.3, 1];

// Unsplash, free licence. Warm lantern-lit hospitality interior — it carries the
// brand gold, and it says "your venue" rather than "a call centre".
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1735045634800-957fd0dad45e?auto=format&fit=crop&w=2000&q=80";

/**
 * The hero, in two states.
 *
 * Resting, it's a headline and the demo pill. The moment a call connects the
 * whole stage re-composes around the conversation: the headline becomes the
 * scenario, a transcript card appears, and fact cards slide in from the right.
 *
 * This is the page's one dark band — a real photograph carries it, graded down
 * under a left-weighted scrim so the headline holds contrast without the image
 * turning to mud. A video slot sits ready above the photo (drop /hero.webm in
 * public/ and uncomment; the photo stays as its poster).
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
 * Photograph + scrim. The scrim is left-weighted rather than uniform: the
 * headline sits on near-solid ink while the right third of the image stays
 * readable, which is what keeps it looking like a photograph instead of a
 * darkened rectangle. It deepens further during a call so the transcript card
 * and fact cards read cleanly over it.
 */
function HeroBackdrop({ inCall }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-orbit-ink">
      {/*
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/hero.webm" poster={HERO_IMAGE}
        autoPlay loop muted playsInline
      />
      */}
      <img
        src={HERO_IMAGE}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
      />

      {/* Left-weighted scrim for the copy, plus a base tint over the whole frame. */}
      <div className="absolute inset-0 bg-gradient-to-r from-orbit-ink via-orbit-ink/85 to-orbit-ink/25" />
      <motion.div
        animate={{ opacity: inCall ? 0.72 : 0.42 }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 bg-orbit-ink"
      />

      {/* A single warm bloom ties the photograph to the brand gold. */}
      <div className="animate-orbit-drift-slow absolute -right-[10%] top-[6%] h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.20),transparent_62%)] blur-3xl" />

      <div className="grain absolute inset-0 opacity-40" />
      {/* Fades into the light section that follows. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-orbit-ink" />
    </div>
  );
}
