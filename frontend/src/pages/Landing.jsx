import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Lenis from "lenis";
import {
  ArrowRight, Lock, ShieldCheck, CheckCheck, Menu, X, ChevronDown,
  PhoneCall, Cpu, Link2, PlayCircle, RefreshCw,
  PhoneIncoming, HelpCircle, MessageCircle, CalendarX,
  Database, Zap, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { VerticalShowcase } from "@/components/landing/VerticalShowcase";
import { TiltCard } from "@/components/landing/TiltCard";
import { HeroStage } from "@/components/landing/HeroStage";
import { VideoLayer } from "@/components/landing/VideoLayer";
import { LANDING_MEDIA } from "@/components/landing/media";
import { OrbitLogo, OrbitRing } from "@/components/OrbitLogo";
import { ConversationProvider } from "@/components/landing/useDemoSession";

/**
 * ORBIT's public landing page.
 *
 * The argument it has to win: every other AI voice platform hands you a builder
 * and wishes you luck — ORBIT's team builds, tests and maintains your employee
 * for you. That difference drives the section order, and every section carries
 * a different treatment so the page keeps earning attention on the way down.
 *
 * Light throughout, with three dark bands (hero, the "one ordinary day" story,
 * and the closing CTA). No stock photography: the product carries the page.
 */

const STEPS = [
  [PhoneCall, "01", "We learn your business", "One onboarding call. That's your whole part."],
  [Cpu, "02", "We build your employee", "Personality + knowledge, live in under a week."],
  [Link2, "03", "We connect your number", "Phone and WhatsApp, wired up by us."],
  [PlayCircle, "04", "We test it with you", "You approve real test calls before it goes live."],
  [RefreshCw, "05", "We keep improving it", "Included every month — not an extra."],
];


// Illustrative situations, labelled as such — built from the kinds of calls
// ORBIT handles, not from a customer's real logs (AGENT.md rule 7).
//
// This used to be a "day in the life" timeline (02:14, 09:40 …) that asked a
// visitor to reconstruct a story from five disconnected timestamps — even a
// close read left the point unclear. A straight before/after per situation
// needs no reconstruction: one side is the cost, the other is the fix, side
// by side, in one glance.
const WITHOUT_WITH = [
  [PhoneIncoming, "A guest calls at 2am", "Rings out. No answer.", "Answered — room held instantly."],
  [PhoneCall, "Three calls ring at once", "Two go to voicemail.", "All three answered — 2 booked."],
  [HelpCircle, "A menu or policy question", "Staff says “let me check.”", "Answered from your live data."],
  [MessageCircle, "A booking comes on WhatsApp", "Sits unread for hours.", "Confirmed back in seconds."],
  [CalendarX, "A late-night cancellation", "Room sits empty next day.", "Freed and re-listed by morning."],
];

const SECURITY = [
  [Lock, "Secrets stay server-side",
   "Every provider key and business credential stays on our servers — never sent to the browser, never shown to customers."],
  [ShieldCheck, "Strict tenant isolation",
   "Your data resolves from your authenticated session, never from the request. Cross-tenant access is impossible by design."],
  [CheckCheck, "Safe by default",
   "It reads data freely when authorised. Bookings, changes and payments always require explicit confirmation."],
];

const FAQ = [
  ["Do I have to set anything up?",
   "No. You send us your business details; our team does the configuration, the phone routing and the WhatsApp approval. Your side is one onboarding call and a review of the test calls."],
  ["How long until it goes live?",
   "Typically under a week from the day we have your business information. Nothing goes live until you have heard it and approved it."],
  ["Will it sound robotic to my guests?",
   "It speaks natural Indian-English and Hindi, tuned to how your business talks. You hear it and tell us what to change before a single real customer does."],
  ["What if it doesn't know an answer?",
   "It says so and takes a message, or transfers to your team. It is built never to invent a price, a room or a slot."],
  ["My menu and tariffs change. Then what?",
   "Tell us and we update it — that is included, not an extra. Where your systems are connected, it reads the change automatically."],
  ["Is my data safe?",
   "Your data is isolated to your business and resolved from your authenticated session. Provider keys and credentials never reach the browser."],
];

const NAV_LINKS = [
  ["How it works", "#how"],
  ["Your team", "#team"],
  ["Channels", "#channels"],
  ["Security", "#security"],
];

const Eyebrow = ({ children, onDark = false }) => (
  <span
    className={`text-[12px] uppercase tracking-[0.18em] ${
      onDark ? "text-orbit-cream/40" : "text-orbit-goldink"
    }`}
  >
    {children}
  </span>
);

const H2 = ({ children, onDark = false, className = "" }) => (
  <h2
    className={`font-display font-semibold leading-[1] tracking-[-0.035em] ${
      onDark ? "text-orbit-cream" : "text-orbit-text"
    } ${className}`}
    style={{ fontSize: "clamp(2.1rem,4.2vw,3.5rem)" }}
  >
    {children}
  </h2>
);

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  // Collapsed by default: six full answers stacked open at once was the
  // single heaviest block of text on the page — nobody running a business
  // reads six paragraphs to find the one question they had. A tap now
  // reveals just the answer they asked for.
  const [openFaq, setOpenFaq] = useState(null);
  // Nav no longer stays pinned. It reads as clutter when it never moves, and
  // it steals space from the page on a phone. Instead it slides up out of
  // the way once you've scrolled past the hero, and slides back the moment
  // you scroll up — so it's there when you want it, gone when you don't.
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setNavHidden(y > lastY && y > 140);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let id;
    const raf = (t) => {
      lenis.raf(t);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <ConversationProvider>
      <div className="min-h-screen overflow-x-hidden bg-orbit-paper text-orbit-text antialiased">
        {/* NAV
            Solid white from the first pixel. It used to start transparent over
            the dark hero, which put a cream logo on a moving video — the name
            was the least readable thing on the page. Vapi's bar is solid for
            exactly this reason: the brand should never have to compete with
            whatever is playing behind it. */}
        <header
          className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out ${
            navHidden && !menuOpen ? "-translate-y-full" : "translate-y-0"
          }`}
        >
          <div className="border-b border-black/[0.07] bg-white/90 backdrop-blur-2xl">
            <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
              <Link
                to="/"
                className="flex items-center gap-2.5 text-orbit-text"
                data-testid="nav-logo"
              >
                <OrbitLogo className="h-[34px] w-[34px]" title="ORBIT" />
                <span className="font-display text-[26px] font-bold leading-none tracking-[-0.045em]">
                  ORBIT
                </span>
              </Link>

              <div className="hidden items-center gap-9 text-[15px] text-orbit-text/65 md:flex">
                {NAV_LINKS.map(([label, href]) => (
                  <a key={href} href={href} className="transition-colors hover:text-orbit-text">
                    {label}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Link to="/login" data-testid="nav-signin" className="hidden sm:block">
                  <Button
                    variant="ghost"
                    className="h-9 rounded-full px-4 text-sm text-orbit-text/70 hover:bg-black/5 hover:text-orbit-text"
                  >
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-getstarted">
                  <Button className="h-9 rounded-full bg-orbit-text px-5 text-sm font-medium text-white hover:bg-orbit-text/85">
                    Get started
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  className="grid h-9 w-9 place-items-center rounded-full text-orbit-text/70 transition-colors hover:bg-black/5 md:hidden"
                >
                  {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </nav>
          </div>

          {menuOpen && (
            <div className="h-[calc(100dvh-68px)] bg-orbit-sand md:hidden">
              {NAV_LINKS.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-black/[0.07] px-6 py-5 text-xl text-orbit-text/80"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block border-b border-black/[0.07] px-6 py-5 text-xl text-orbit-text/80"
              >
                Sign in
              </Link>
            </div>
          )}
        </header>

        {/* ── DARK BAND 1 ── */}
        <div className="pt-[68px]">
          <HeroStage />
        </div>

        <section className="border-b border-black/[0.06] bg-orbit-sand py-5">
          <p className="mx-auto max-w-7xl px-6 text-center text-[12px] uppercase tracking-[0.18em] text-orbit-text/40 lg:px-10">
            Hotels · Restaurants · Clinics · Real estate · Salons · Any business that answers a phone
          </p>
        </section>

        {/* HOW — the differentiator */}
        <section id="how" className="bg-orbit-paper py-14 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <Reveal>
                  <Eyebrow>How ORBIT works</Eyebrow>
                  <H2 className="mt-5">
                    You don&rsquo;t build it.
                    <br />
                    We build it for you.
                  </H2>
                  <p className="mt-6 text-[17px] leading-relaxed text-orbit-text/60">
                    Most AI voice platforms hand you a blank builder and wish you luck. ORBIT
                    doesn&rsquo;t. Our team configures, tests and maintains your AI employee — you
                    just tell us how your business runs.
                  </p>
                  <div className="mt-8 rounded-2xl border border-orbit-goldink/20 bg-orbit-gold/10 p-5">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-orbit-goldink">
                      What you never touch
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-orbit-text/70">
                      API keys · webhooks · prompts · phone routing · servers · billing plumbing
                    </p>
                  </div>
                </Reveal>
              </div>
            </div>

            <div className="lg:col-span-7">
              {/* A loose, floating cascade rather than a flat grid — each card
                  sits slightly off the last and tilts toward the cursor, so
                  the process reads as something with real depth to it, not a
                  checklist. The gold rail behind them is the thread that
                  says "one continuous process" even while the cards drift. */}
              <div className="relative">
                <div className="absolute left-6 top-2 bottom-2 hidden w-px bg-gradient-to-b from-orbit-gold/60 via-orbit-gold/15 to-transparent sm:block" />
                <div className="space-y-5">
                  {STEPS.map(([Icon, num, title, blurb], i) => (
                    <Reveal delay={i * 0.05} key={num}>
                      <TiltCard
                        maxTilt={5}
                        className={`rounded-2xl ${i % 2 === 1 ? "sm:ml-12" : ""}`}
                      >
                        <div className="flex items-start gap-5 rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_18px_46px_rgba(20,20,26,0.07)]">
                          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orbit-text text-white">
                            <Icon className="h-6 w-6" />
                          </span>
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="font-display text-[12.5px] font-semibold text-orbit-goldink">
                                {num}
                              </span>
                              <div className="font-display text-[18px] font-semibold tracking-tight">
                                {title}
                              </div>
                            </div>
                            <p className="mt-1.5 text-[14.5px] leading-relaxed text-orbit-text/55">
                              {blurb}
                            </p>
                          </div>
                        </div>
                      </TiltCard>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM
            HOW answers "what happens when we sign up." This section answers
            a different question a visitor is silently asking: "is this built
            for MY kind of business, or some generic one." The pale gold
            bloom behind the showcase is there so the section reads as a
            deliberate, filled panel rather than a card floating in empty
            space — the exact "incomplete" feeling this section used to
            leave on a full-width monitor. */}
        <section id="team" className="relative overflow-hidden border-y border-black/[0.06] bg-orbit-sand py-16 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-[10%] top-[15%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.14),transparent_65%)] blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Built for your business</Eyebrow>
                <H2 className="mt-5">Not a generic bot. Your line of work, specifically.</H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-text/60">
                  Pick your business below and watch the same employee answer the way a hotel, a
                  restaurant, a clinic or an agent actually needs to.
                </p>
              </div>
            </Reveal>

            <div className="mt-10">
              <VerticalShowcase />
            </div>
          </div>
        </section>

        {/* ── DARK BAND 2: one ordinary day ── */}
        <section className="relative overflow-hidden bg-orbit-ink py-14 lg:py-20">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="animate-orbit-drift-slow absolute -right-[12%] top-[10%] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.16),transparent_62%)] blur-3xl" />
            <div className="grain absolute inset-0" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow onDark>Before / after</Eyebrow>
                <H2 onDark className="mt-5">
                  Every missed call has a cost.
                </H2>
                <p className="mt-4 text-[16px] leading-relaxed text-orbit-cream/55">
                  Five situations that come up at any hotel, any week. Same situation, two
                  outcomes — one with ORBIT answering, one without.
                </p>
              </div>
            </Reveal>

            <div className="mt-7 space-y-2">
              {/* Column headers once, above the rows — repeating "Without /
                  With" on every row would be the exact re-reading tax this
                  section used to impose. */}
              <div className="hidden gap-6 px-5 sm:grid sm:grid-cols-[220px_1fr_1fr]">
                <span />
                <span className="text-[11px] uppercase tracking-[0.16em] text-orbit-cream/30">
                  Without ORBIT
                </span>
                <span className="text-[11px] uppercase tracking-[0.16em] text-orbit-live/60">
                  With ORBIT
                </span>
              </div>
              {WITHOUT_WITH.map(([Icon, scenario, without, withIt], i) => (
                <Reveal delay={i * 0.05} key={scenario}>
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-4 sm:grid sm:grid-cols-[220px_1fr_1fr] sm:items-center sm:gap-6 sm:px-5 sm:py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-orbit-cream/70">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[14px] font-medium leading-snug text-orbit-cream/85">
                        {scenario}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-0 sm:contents">
                      <div className="rounded-lg bg-black/25 px-3 py-2 sm:bg-transparent sm:px-0 sm:py-0">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-orbit-cream/30 sm:hidden">
                          Without ORBIT
                        </div>
                        <div className="mt-0.5 text-[13px] leading-snug text-orbit-cream/45 line-through decoration-orbit-cream/25 sm:mt-0">
                          {without}
                        </div>
                      </div>
                      <div className="rounded-lg border border-orbit-live/20 bg-orbit-live/[0.1] px-3 py-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-orbit-live/60 sm:hidden">
                          With ORBIT
                        </div>
                        <div className="mt-0.5 text-[13px] font-medium leading-snug text-orbit-cream sm:mt-0">
                          {withIt}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <p className="mt-5 text-[12.5px] text-orbit-cream/35">
              Illustrative situations, built from the kinds of calls ORBIT handles.
            </p>
          </div>
        </section>

        {/* KNOWS — the tool call */}
        <section className="bg-orbit-paper py-14 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:gap-20 lg:px-10">
            <div className="lg:col-span-5">
              <Reveal>
                <Eyebrow>More than a chatbot</Eyebrow>
                <H2 className="mt-5">
                  It doesn&rsquo;t guess.
                  <br />
                  It knows.
                </H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-text/60">
                  ORBIT connects to your systems, so answers come from real data — not guesses.
                  Nothing connected yet? It says so.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {[
                    [Database, "Reads", "Availability, bookings, orders, appointments"],
                    [Zap, "Acts", "Creates bookings, captures leads"],
                    [Ban, "Never", "Invents a price, a room or a slot"],
                  ].map(([Icon, label, value]) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-orbit-sand px-4 py-3"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orbit-text text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-orbit-goldink">
                          {label}
                        </div>
                        <div className="text-[14px] leading-snug text-orbit-text/70">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={0.08}>
                {/* No function-call syntax any more — check_availability(...)
                    read as a debugger, not a demo, and needed a technical
                    reader to make sense of it. A plain-English tag under the
                    message that earned it says the same thing (it looked
                    something up, it acted) without asking anyone to read
                    code. */}
                <TiltCard maxTilt={4} className="rounded-[26px]">
                  <div className="rounded-[26px] border border-black/[0.07] bg-orbit-sand p-7">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-orbit-text/40">
                      What happened on this call
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-[14px]">
                        <span className="text-orbit-text/40">Guest:</span> Do you have a sea-view
                        room on the 14th?
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orbit-gold/15 px-3 py-1.5 text-[12.5px] font-medium text-orbit-goldink">
                        <Database className="h-3.5 w-3.5" /> Checked real-time room availability
                      </span>
                      <div className="rounded-xl bg-orbit-text px-4 py-3 text-[14px] text-white">
                        Yes — two sea-view rooms are open on the 14th at ₹16,800 plus GST.
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orbit-gold/15 px-3 py-1.5 text-[12.5px] font-medium text-orbit-goldink">
                        <Zap className="h-3.5 w-3.5" /> Started the booking, right there in the call
                      </span>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-black/[0.08] pt-4 text-[13px] text-orbit-text/50">
                      <span className="h-2 w-2 rounded-full bg-orbit-live" />
                      Bookings and payments always wait for the guest&rsquo;s explicit yes.
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="border-y border-black/[0.06] bg-orbit-sand py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Your dashboard</Eyebrow>
                <H2 className="mt-5">You watch the outcomes. We run the machine.</H2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-text/60">
                  Every call and chat, with a transcript, a summary and what came of it. No prompts,
                  no logs, no configuration screens — that side is ours.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative mt-10">
                <div className="absolute inset-x-16 -top-8 h-48 rounded-full bg-orbit-gold/50 blur-[100px]" />
                <TiltCard maxTilt={3} className="rounded-[26px]">
                <div className="relative rounded-[26px] border border-black/[0.08] bg-orbit-ink p-3 shadow-[0_40px_110px_rgba(20,20,26,0.3)]">
                  <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#0B0B0F]">
                    {/* A screen recording of the real dashboard replaces the mock
                        the moment one is configured in media.js. */}
                    {LANDING_MEDIA.dashboard?.src ? (
                      <VideoLayer
                        media={LANDING_MEDIA.dashboard}
                        className="block min-h-[380px] w-full object-cover"
                      />
                    ) : (
                    <div className="grid min-h-[380px] grid-cols-12">
                      <div className="col-span-3 hidden border-r border-white/[0.07] p-5 md:block">
                        <div className="mb-8 flex items-center gap-2 text-orbit-cream">
                          <OrbitLogo className="h-4 w-4" />
                          <span className="text-sm font-medium">Taj Palace</span>
                        </div>
                        {["Overview", "AI Employees", "Channels", "Conversations", "Leads", "Settings"].map(
                          (n, i) => (
                            <div
                              key={n}
                              className={`mb-1 rounded-lg px-3 py-2 text-sm ${
                                i === 0 ? "bg-white/10 text-orbit-cream" : "text-orbit-cream/35"
                              }`}
                            >
                              {n}
                            </div>
                          )
                        )}
                      </div>

                      <div className="col-span-12 p-6 md:col-span-9">
                        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                          {[["Conversations", "128"], ["Call minutes", "342"], ["Leads captured", "19"], ["Missed calls", "0"]].map(
                            ([label, value]) => (
                              <div
                                key={label}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
                              >
                                <div className="font-display text-2xl font-semibold text-orbit-cream">
                                  {value}
                                </div>
                                <div className="mt-1 text-xs text-orbit-cream/35">{label}</div>
                              </div>
                            )
                          )}
                        </div>

                        <div className="space-y-2.5">
                          {[["Room booking enquiry", "Booked", "2m 23s"], ["Early check-in request", "Noted", "0m 51s"], ["Group dinner — 20 pax", "Lead → owner", "1m 44s"]].map(
                            ([title, status, dur]) => (
                              <div
                                key={title}
                                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
                              >
                                <span className="text-sm text-orbit-cream">{title}</span>
                                <div className="flex items-center gap-4">
                                  <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-orbit-cream/60">
                                    {status}
                                  </span>
                                  <span className="text-xs text-orbit-cream/35">{dur}</span>
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-orbit-cream/25">
                          Illustrative preview
                        </p>
                      </div>
                    </div>
                    )}
                  </div>
                </div>
                </TiltCard>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CHANNELS */}
        <section id="channels" className="bg-orbit-paper py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Channels</Eyebrow>
                <H2 className="mt-5">One employee. Both channels.</H2>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <Reveal>
                <TiltCard maxTilt={4} className="h-full rounded-[26px]">
                <div className="h-full rounded-[26px] border border-black/[0.07] bg-orbit-sand p-9">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-semibold tracking-tight">Phone</h3>
                    <span className="rounded-full bg-orbit-live/[0.12] px-3 py-1 text-[12px] text-orbit-live">
                      Live
                    </span>
                  </div>
                  <p className="mt-3 text-[16px] leading-relaxed text-orbit-text/60">
                    An Indian number, routed by us straight to your AI employee. Natural
                    conversation, zero hold music, no IVR menus.
                  </p>
                  <div className="mt-7 rounded-2xl border border-black/[0.07] bg-white p-5">
                    <div className="flex items-center justify-between text-[12px] uppercase tracking-[0.14em] text-orbit-text/35">
                      <span>Inbound · +91 98•• ••••12</span>
                      <span>1m 12s</span>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      <div className="max-w-[80%] rounded-xl bg-orbit-sand px-3.5 py-2 text-[13px]">
                        Is the pool open till late?
                      </div>
                      <div className="ml-auto max-w-[85%] rounded-xl bg-orbit-text px-3.5 py-2 text-[13px] text-white">
                        Yes, the pool is open until 10pm. Would you like a poolside table booked?
                      </div>
                    </div>
                  </div>
                </div>
                </TiltCard>
              </Reveal>

              <Reveal delay={0.08}>
                <TiltCard maxTilt={4} className="h-full rounded-[26px]">
                <div className="h-full rounded-[26px] border border-black/[0.07] bg-orbit-sand p-9">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl font-semibold tracking-tight">WhatsApp</h3>
                    <span className="rounded-full bg-orbit-live/[0.12] px-3 py-1 text-[12px] text-orbit-live">
                      Set up by us
                    </span>
                  </div>
                  <p className="mt-3 text-[16px] leading-relaxed text-orbit-text/60">
                    Meta and BSP approval is our paperwork, not yours. You just see when it&rsquo;s
                    connected.
                  </p>
                  <div className="mt-7 rounded-2xl border border-black/[0.07] bg-white p-5">
                    <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-orbit-text/35">
                      <span className="h-2 w-2 rounded-full bg-orbit-live" />
                      Connected
                    </div>
                    <div className="mt-4 space-y-2.5">
                      <div className="max-w-[80%] rounded-xl bg-orbit-sand px-3.5 py-2 text-[13px]">
                        Booking confirm hua?
                      </div>
                      <div className="ml-auto max-w-[85%] rounded-xl bg-orbit-live px-3.5 py-2 text-[13px] text-white">
                        Ji haan — Deluxe King, Sat 14 Mar. Confirmation bhej diya hai.
                      </div>
                    </div>
                  </div>
                </div>
                </TiltCard>
              </Reveal>
            </div>
          </div>
        </section>

        {/* SECURITY */}
        {/* SECURITY
            Three plain white cards used to sit here — correct, but the
            flattest moment on the page, and it broke the site's own rhythm
            (every other proof section is a dark showcase panel). One panel
            with a pulsing shield as the anchor reads as a statement rather
            than a form's fine print, and it's the same "showcase card"
            language as Dashboard and Knows, so the page stops feeling like a
            pile of unrelated blocks. */}
        <section id="security" className="bg-orbit-paper py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Security</Eyebrow>
                <H2 className="mt-5">Built so the boring parts never bite you.</H2>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <TiltCard maxTilt={3} className="mt-9 rounded-[28px]">
                <div className="rounded-[28px] bg-orbit-ink p-8 sm:p-10 lg:p-12">
                  <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-14">
                    <div className="relative mx-auto grid h-24 w-24 shrink-0 place-items-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orbit-gold/20" />
                      <span className="relative grid h-20 w-20 place-items-center rounded-full bg-white/[0.06] text-orbit-gold ring-1 ring-white/10">
                        <ShieldCheck className="h-9 w-9" />
                      </span>
                    </div>
                    <div className="grid gap-7 sm:grid-cols-3">
                      {SECURITY.map(([Icon, title, desc]) => (
                        <div key={title}>
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.08] text-orbit-gold">
                            <Icon className="h-4 w-4" />
                          </span>
                          <h3 className="mt-4 font-display text-[16px] font-semibold text-white">
                            {title}
                          </h3>
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/50">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-black/[0.06] bg-orbit-paper py-14 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-4">
              <Reveal>
                <Eyebrow>Questions</Eyebrow>
                <H2 className="mt-5">The ones owners actually ask.</H2>
              </Reveal>
            </div>
            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08] lg:col-span-8">
              {FAQ.map(([q, a], i) => {
                const open = openFaq === i;
                return (
                  <Reveal delay={i * 0.04} key={q}>
                    <div className="py-5">
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        data-testid={`faq-question-${i}`}
                        className="flex w-full items-center justify-between gap-6 text-left"
                      >
                        <span className="font-display text-[18px] font-semibold tracking-tight">
                          {q}
                        </span>
                        <ChevronDown
                          className={`h-4.5 w-4.5 shrink-0 text-orbit-text/40 transition-transform duration-300 ${
                            open ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <p className="max-w-2xl pb-1 pt-3 text-[15px] leading-relaxed text-orbit-text/60">
                              {a}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── DARK BAND 3: CTA ── */}
        <section className="relative overflow-hidden bg-orbit-ink py-16 lg:py-24">
          <div aria-hidden="true" className="absolute inset-0">
            <VideoLayer
              media={LANDING_MEDIA.cta}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="animate-orbit-drift absolute left-1/2 top-1/2 h-[640px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.24),transparent_62%)] blur-3xl" />
            <OrbitRing className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 text-orbit-cream/[0.05]" />
            <div className="grain absolute inset-0" />
          </div>

          <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-semibold leading-[0.98] tracking-[-0.04em] text-orbit-cream"
              style={{ fontSize: "clamp(2.3rem,5vw,4.1rem)" }}
            >
              Tell us how your
              <br />
              business runs.
            </motion.h2>
            <Reveal delay={0.08}>
              <p className="mx-auto mt-7 max-w-lg text-[17px] leading-relaxed text-orbit-cream/60">
                One call is all we need to start. We build your AI employee, you approve it, and it
                answers from day one.
              </p>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Link to="/register" data-testid="cta-getstarted">
                  <Button className="h-[54px] rounded-2xl bg-orbit-cream px-8 text-[15px] font-medium text-orbit-ink transition-transform hover:bg-white active:scale-[0.98]">
                    Get started
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    variant="outline"
                    className="h-[54px] rounded-2xl border-white/20 bg-transparent px-8 text-[15px] text-orbit-cream hover:bg-white/10 hover:text-orbit-cream"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/[0.07] bg-orbit-ink py-12 text-orbit-cream">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 md:flex-row lg:px-10">
            <div className="flex items-center gap-2.5">
              <OrbitLogo className="h-[22px] w-[22px]" />
              <span className="font-display font-semibold tracking-[-0.02em]">ORBIT</span>
            </div>
            <p className="text-sm text-orbit-cream/40">AI employees for businesses · India-first</p>
            <div className="flex gap-6 text-sm text-orbit-cream/50">
              <Link to="/terms" className="transition-colors hover:text-orbit-cream">Terms</Link>
              <Link to="/privacy" className="transition-colors hover:text-orbit-cream">Privacy</Link>
              <Link to="/ai-disclosure" className="transition-colors hover:text-orbit-cream">AI disclosure</Link>
            </div>
          </div>
        </footer>
      </div>
    </ConversationProvider>
  );
}
