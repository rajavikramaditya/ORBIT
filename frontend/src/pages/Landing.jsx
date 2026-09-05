import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Lenis from "lenis";
import {
  ArrowRight, Check, Lock, ShieldCheck, CheckCheck, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
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
  ["01", "We learn your business",
   "A call with you, then we read everything — your rooms and rates, menu, services, timings, policies, the questions guests actually ask.",
   "You send us what you have. We do the rest."],
  ["02", "We build your employee",
   "Our team writes the personality, the knowledge and the rules. Not a template — built around how your business actually talks.",
   "Typically live in under a week."],
  ["03", "We connect your number",
   "Your Indian phone number and WhatsApp are wired up by us. No API keys, no webhooks, nothing technical on your side.",
   "Phone + WhatsApp, one employee."],
  ["04", "We test it with you",
   "You listen to real test calls and tell us what to change. It only goes live when you say it sounds right.",
   "Draft → Testing → Approved → Live."],
  ["05", "We keep improving it",
   "Every month we review real conversations, fix what missed, and teach it what's new — a seasonal menu, a new tariff, a new service.",
   "Included. Forever."],
];

const TEAM = [
  { initial: "R", name: "Riya", role: "AI Reservation Assistant", vertical: "Hotels",
    quote: "A Deluxe King is free on Saturday at ₹14,500 plus GST. Shall I hold it?",
    caps: ["Check live availability", "Take a booking", "Answer amenities", "Send confirmation"] },
  { initial: "A", name: "Aarav", role: "AI Booking & Order Assistant", vertical: "Restaurants",
    quote: "Table for four at 8pm is open. Any preference — indoor or terrace?",
    caps: ["Table reservations", "Take orders", "Today's specials", "Timings & directions"] },
  { initial: "A", name: "Ananya", role: "AI Appointment Assistant", vertical: "Clinics",
    quote: "Dr. Sharma has 4:30pm free on Thursday. Shall I book that for you?",
    caps: ["Book appointments", "Send reminders", "Doctor availability", "Patient queries"] },
  { initial: "K", name: "Kabir", role: "AI Property Advisor", vertical: "Real estate",
    quote: "That 3BHK is ₹1.4 Cr. Would you like a site visit this weekend?",
    caps: ["Capture leads", "Property details", "Schedule site visits", "Qualify buyers"] },
];

// An illustrative day, labelled as such — built from the kinds of calls ORBIT
// handles, not from a customer's real logs (AGENT.md rule 7).
const DAY = [
  ["02:14", "Nobody is at the desk", "“Hi, I'm landing at 6am — is early check-in possible?”",
   "Answered. Early check-in noted on the booking.", true],
  ["09:40", "Three calls at once", "Front desk is busy with a checkout queue.",
   "All three answered. Two bookings, one enquiry logged as a lead.", false],
  ["14:05", "A question your staff can't answer", "“Do you have a Jain menu for tomorrow's party of 20?”",
   "Answered from your live menu. Owner pinged for the group booking.", true],
  ["21:30", "WhatsApp, not a call", "“Booking confirm hua kya?”",
   "Confirmation resent on WhatsApp in seconds.", true],
  ["23:50", "After everyone has gone home", "A guest calls to cancel for tomorrow.",
   "Cancellation captured. Room freed. You see it in the morning.", false],
];

const INCLUDED = [
  ["Business study & setup", "We read your rooms, menu, services, policies and timings."],
  ["Employee build", "Personality, knowledge and rules written by our team."],
  ["Phone + WhatsApp", "Number provisioning, routing and Meta approval — all ours."],
  ["Testing with you", "Real test calls until you say it sounds right."],
  ["Monthly tuning", "We review real conversations and keep improving it."],
  ["Support in your language", "Talk to a person, in Hindi or English, when you need to."],
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
  // The nav sits transparent on the dark hero, then turns to paper once the
  // light body is behind it — otherwise cream-on-white text disappears.
  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight - 140);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const navSolid = pastHero || menuOpen;

  return (
    <ConversationProvider>
      <div className="min-h-screen overflow-x-hidden bg-orbit-paper text-orbit-text antialiased">
        {/* NAV */}
        <header className="fixed inset-x-0 top-0 z-50">
          <div
            className={`transition-colors duration-300 ${
              navSolid
                ? "border-b border-black/[0.07] bg-white/85 backdrop-blur-2xl"
                : "border-b border-transparent"
            }`}
          >
            <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
              <Link
                to="/"
                className={`flex items-center gap-2.5 transition-colors ${
                  navSolid ? "text-orbit-text" : "text-orbit-cream"
                }`}
                data-testid="nav-logo"
              >
                <OrbitLogo className="h-[26px] w-[26px]" title="ORBIT" />
                <span className="font-display text-lg font-semibold tracking-[-0.02em]">ORBIT</span>
              </Link>

              <div
                className={`hidden items-center gap-9 text-[15px] transition-colors md:flex ${
                  navSolid ? "text-orbit-text/60" : "text-orbit-cream/55"
                }`}
              >
                {NAV_LINKS.map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className={`transition-colors ${
                      navSolid ? "hover:text-orbit-text" : "hover:text-orbit-cream"
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Link to="/login" data-testid="nav-signin" className="hidden sm:block">
                  <Button
                    variant="ghost"
                    className={`h-9 rounded-full px-4 text-sm ${
                      navSolid
                        ? "text-orbit-text/70 hover:bg-black/5 hover:text-orbit-text"
                        : "text-orbit-cream/70 hover:bg-white/10 hover:text-orbit-cream"
                    }`}
                  >
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-getstarted">
                  <Button
                    className={`h-9 rounded-full px-5 text-sm font-medium ${
                      navSolid
                        ? "bg-orbit-text text-white hover:bg-orbit-text/85"
                        : "bg-orbit-cream text-orbit-ink hover:bg-white"
                    }`}
                  >
                    Get started
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  className={`grid h-9 w-9 place-items-center rounded-full transition-colors md:hidden ${
                    navSolid
                      ? "text-orbit-text/70 hover:bg-black/5"
                      : "text-orbit-cream/70 hover:bg-white/10"
                  }`}
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
        <HeroStage />

        <section className="border-b border-black/[0.06] bg-orbit-sand py-5">
          <p className="mx-auto max-w-7xl px-6 text-center text-[12px] uppercase tracking-[0.18em] text-orbit-text/40 lg:px-10">
            Hotels · Restaurants · Clinics · Real estate · Salons · Any business that answers a phone
          </p>
        </section>

        {/* HOW — the differentiator */}
        <section id="how" className="bg-orbit-paper py-24 lg:py-28">
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
              <div className="border-l border-black/[0.08] pl-9">
                {STEPS.map(([num, title, desc, note], i) => (
                  <Reveal delay={i * 0.06} key={num}>
                    <div className="relative pb-10 last:pb-0">
                      <div className="absolute -left-[49px] grid h-9 w-9 place-items-center rounded-full bg-orbit-text text-[12px] font-semibold text-white">
                        {num}
                      </div>
                      <div className="font-display text-[22px] font-semibold tracking-tight">
                        {title}
                      </div>
                      <p className="mt-2.5 max-w-lg text-[16px] leading-relaxed text-orbit-text/60">
                        {desc}
                      </p>
                      <div className="mt-3 inline-flex rounded-lg bg-orbit-sand px-3 py-1.5 text-[13px] text-orbit-text/55">
                        {note}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TEAM */}
        <section id="team" className="border-y border-black/[0.06] bg-orbit-sand py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Your team</Eyebrow>
                <H2 className="mt-5">An employee built for your line of work.</H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-text/60">
                  Every ORBIT employee is configured for one kind of business, then customised again
                  for yours. These are the ones running today — if your business isn&rsquo;t here, we
                  build one for it.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              {TEAM.map((m, i) => (
                <Reveal delay={i * 0.06} key={m.name}>
                  <div className="h-full rounded-[26px] border border-black/[0.07] bg-white p-8 shadow-[0_4px_24px_rgba(20,20,26,0.05)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-orbit-text font-display text-xl font-semibold text-white">
                          {m.initial}
                        </div>
                        <div>
                          <div className="font-display text-[22px] font-semibold tracking-tight">
                            {m.name}
                          </div>
                          <div className="text-[14px] text-orbit-goldink">{m.role}</div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-black/[0.09] px-3 py-1 text-[11px] uppercase tracking-[0.13em] text-orbit-text/45">
                        {m.vertical}
                      </span>
                    </div>

                    <div className="mt-6 rounded-2xl bg-orbit-sand px-5 py-4 text-[15px] leading-snug text-orbit-text/80">
                      &ldquo;{m.quote}&rdquo;
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {m.caps.map((c) => (
                        <span
                          key={c}
                          className="rounded-lg bg-orbit-text/[0.05] px-3 py-1.5 text-[13px] text-orbit-text/65"
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center gap-5 border-t border-black/[0.07] pt-4 text-[13px] text-orbit-text/45">
                      <span>Phone</span>
                      <span>WhatsApp</span>
                      <span>Hindi + English</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DARK BAND 2: one ordinary day ── */}
        <section className="relative overflow-hidden bg-orbit-ink py-24 lg:py-28">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="animate-orbit-drift-slow absolute -right-[12%] top-[10%] h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.16),transparent_62%)] blur-3xl" />
            <div className="grain absolute inset-0" />
          </div>

          <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow onDark>One ordinary day</Eyebrow>
                <H2 onDark className="mt-5">
                  The calls you are losing right now.
                </H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-cream/55">
                  Not a pitch — just a normal Tuesday at a 40-room property, and what ORBIT does
                  with it.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 space-y-3">
              {DAY.map(([time, headline, moment, outcome, good], i) => (
                <Reveal delay={i * 0.05} key={time}>
                  <div className="grid items-center gap-5 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-6 py-5 md:grid-cols-12">
                    <div className="md:col-span-2">
                      <div className="font-display text-[26px] font-semibold text-orbit-cream">
                        {time}
                      </div>
                      <div className="text-[13px] text-orbit-cream/40">{headline}</div>
                    </div>
                    <div className="text-[15px] leading-snug text-orbit-cream/75 md:col-span-5">
                      {moment}
                    </div>
                    <div className="flex items-start gap-2.5 md:col-span-5">
                      <span
                        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                          good ? "bg-orbit-live" : "bg-orbit-gold"
                        }`}
                      />
                      <span className="text-[15px] leading-snug text-orbit-cream/55">
                        {outcome}
                      </span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <p className="mt-8 text-[14px] text-orbit-cream/35">
              Illustrative day, built from the kinds of calls ORBIT handles.
            </p>
          </div>
        </section>

        {/* KNOWS — the tool call */}
        <section className="bg-orbit-paper py-24 lg:py-28">
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
                  ORBIT connects to the systems you already run, so answers come from real data —
                  today&rsquo;s availability, this week&rsquo;s menu, tomorrow&rsquo;s slots. Nothing
                  connected yet? It says so, instead of inventing an answer.
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    ["Reads", "Availability, bookings, orders, appointments"],
                    ["Acts", "Creates and changes bookings, captures leads"],
                    ["Never", "Invents a price, a room or a slot that doesn't exist"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-4">
                      <span className="w-[54px] shrink-0 pt-1 text-[12px] uppercase tracking-[0.14em] text-orbit-goldink">
                        {label}
                      </span>
                      <span className="text-[15px] leading-relaxed text-orbit-text/65">{value}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <Reveal delay={0.08}>
                <div className="rounded-[26px] border border-black/[0.07] bg-orbit-sand p-7">
                  <div className="text-[12px] uppercase tracking-[0.16em] text-orbit-text/40">
                    Live tool call · during a call
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-[14px]">
                      <span className="text-orbit-text/40">Guest:</span> Do you have a sea-view room
                      on the 14th?
                    </div>
                    <div className="rounded-xl border border-orbit-goldink/25 bg-orbit-gold/[0.12] px-4 py-3 font-mono text-[13px] text-orbit-goldink">
                      check_availability(date: &quot;14 Mar&quot;, type: &quot;sea view&quot;) → 2
                      rooms, ₹16,800
                    </div>
                    <div className="rounded-xl bg-orbit-text px-4 py-3 text-[14px] text-white">
                      Yes — two sea-view rooms are open on the 14th at ₹16,800 plus GST.
                    </div>
                    <div className="rounded-xl border border-orbit-goldink/25 bg-orbit-gold/[0.12] px-4 py-3 font-mono text-[13px] text-orbit-goldink">
                      create_booking(…) → awaiting guest confirmation
                    </div>
                  </div>
                  <div className="mt-5 flex items-center gap-2 border-t border-black/[0.08] pt-4 text-[13px] text-orbit-text/50">
                    <span className="h-2 w-2 rounded-full bg-orbit-live" />
                    Bookings and payments always need an explicit confirmation.
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="border-y border-black/[0.06] bg-orbit-sand py-24 lg:py-28">
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
              <div className="relative mt-14">
                <div className="absolute inset-x-16 -top-8 h-48 rounded-full bg-orbit-gold/50 blur-[100px]" />
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
              </div>
            </Reveal>
          </div>
        </section>

        {/* CHANNELS */}
        <section id="channels" className="bg-orbit-paper py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Channels</Eyebrow>
                <H2 className="mt-5">One employee. Both channels.</H2>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              <Reveal>
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
              </Reveal>

              <Reveal delay={0.08}>
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
              </Reveal>
            </div>
          </div>
        </section>

        {/* INCLUDED */}
        <section className="border-y border-black/[0.06] bg-orbit-sand py-24 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-5">
              <Reveal>
                <Eyebrow>What&rsquo;s included</Eyebrow>
                <H2 className="mt-5">Everything. That&rsquo;s the point.</H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-text/60">
                  There is no &ldquo;setup tier&rdquo; and no professional-services invoice.
                  Building and running your AI employee <em>is</em> the product.
                </p>
              </Reveal>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
              {INCLUDED.map(([title, desc], i) => (
                <Reveal delay={i * 0.05} key={title}>
                  <div className="h-full rounded-2xl border border-black/[0.07] bg-white p-6">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orbit-live text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <div>
                        <div className="text-[15px] font-semibold">{title}</div>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-orbit-text/55">
                          {desc}
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section id="security" className="bg-orbit-paper py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Security</Eyebrow>
                <H2 className="mt-5">Built so the boring parts never bite you.</H2>
              </div>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {SECURITY.map(([Icon, title, desc], i) => (
                <Reveal delay={i * 0.08} key={title}>
                  <div className="h-full rounded-[22px] border border-black/[0.07] bg-orbit-sand p-8">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orbit-text text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">
                      {title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-orbit-text/55">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-black/[0.06] bg-orbit-paper py-24 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:px-10">
            <div className="lg:col-span-4">
              <Reveal>
                <Eyebrow>Questions</Eyebrow>
                <H2 className="mt-5">The ones owners actually ask.</H2>
              </Reveal>
            </div>
            <div className="divide-y divide-black/[0.08] border-y border-black/[0.08] lg:col-span-8">
              {FAQ.map(([q, a], i) => (
                <Reveal delay={i * 0.04} key={q}>
                  <div className="py-6">
                    <div className="font-display text-[19px] font-semibold tracking-tight">{q}</div>
                    <p className="mt-2.5 max-w-2xl text-[16px] leading-relaxed text-orbit-text/60">
                      {a}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DARK BAND 3: CTA ── */}
        <section className="relative overflow-hidden bg-orbit-ink py-28 lg:py-32">
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
