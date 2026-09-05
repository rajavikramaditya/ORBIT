import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Lenis from "lenis";
import {
  Phone, MessageCircle, ShieldCheck, ArrowRight,
  Lock, BedDouble, UtensilsCrossed, Stethoscope, Building2, Briefcase, ShoppingBag,
  BookText, DatabaseZap, CheckCheck, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/Reveal";
import { HeroStage } from "@/components/landing/HeroStage";
import { OrbitLogo, OrbitRing } from "@/components/OrbitLogo";
import { ConversationProvider } from "@/components/landing/useDemoSession";

const VERTICALS = [
  { industry: "Hotels", person: "Riya", role: "AI Reservation Assistant", desc: "Room availability, bookings and 24/7 guest support.", icon: BedDouble, tag: "Live first" },
  { industry: "Restaurants", person: "Aarav", role: "AI Booking & Order Assistant", desc: "Table reservations, orders and everyday enquiries.", icon: UtensilsCrossed, tag: "F&B" },
  { industry: "Clinics", person: "Ananya", role: "AI Appointment Assistant", desc: "Appointment booking, reminders and patient support.", icon: Stethoscope, tag: "Healthcare" },
  { industry: "Real estate", person: "Kabir", role: "AI Property Advisor", desc: "Lead capture, property enquiries and site-visit scheduling.", icon: Building2, tag: "Property" },
  { industry: "Agencies", person: "Neha", role: "AI Lead Qualification Assistant", desc: "Qualify inbound leads and follow up automatically.", icon: Briefcase, tag: "Services" },
  { industry: "Retail & services", person: "Your AI employee", role: "Fully configurable", desc: "Order status, support and bookings for any customer-facing business.", icon: ShoppingBag, tag: "Any business" },
];

const LIVE_POINTS = [
  { icon: BookText, title: "Knows your business", desc: "Policies, services, hours and FAQs — the full picture, always current." },
  { icon: DatabaseZap, title: "Reads live data", desc: "Availability, bookings, orders and appointments, pulled from your own systems when connected." },
  { icon: CheckCheck, title: "Takes authorised actions", desc: "Create or change a booking, capture a lead — only with the right permissions and a confirmation." },
];

const SECURITY = [
  [Lock, "Secrets stay server-side", "Every provider key and business-system credential stays on our servers — never sent to the browser or exposed to customers."],
  [ShieldCheck, "Strict tenant isolation", "Your data is resolved from your authenticated session, never from the request. Cross-tenant access is impossible by design."],
  [CheckCheck, "Safe by default", "AI reads data automatically when authorised; bookings, changes and payments always require explicit permission and confirmation."],
];

// Deliberately qualitative. ORBIT does not publish uptime percentages, latency
// figures or customer counts it has not measured (AGENT.md rule 7).
const PROOF = [
  ["Never a missed call", "Answers on the first ring, at 3am or during a rush."],
  ["Every conversation kept", "Transcript, summary and outcome for each call and chat."],
  ["One platform, any vertical", "Hotels went live first. The platform isn't hotel software."],
];

const NAV_LINKS = [
  ["Product", "#product"],
  ["Verticals", "#verticals"],
  ["Channels", "#channels"],
  ["Security", "#security"],
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
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
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The full-screen menu owns the viewport while open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <ConversationProvider>
      <div className="min-h-screen overflow-x-hidden bg-orbit-ink text-orbit-cream antialiased">
        {/* NAV */}
        <header className="fixed inset-x-0 top-0 z-50">
          <div
            className={`transition-colors duration-300 ${
              scrolled || menuOpen
                ? "border-b border-white/[0.07] bg-orbit-ink/80 backdrop-blur-2xl"
                : "border-b border-transparent"
            }`}
          >
            <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6 lg:px-10">
              <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
                <OrbitLogo className="h-[26px] w-[26px] text-orbit-cream" title="ORBIT" />
                <span className="font-display text-lg font-semibold tracking-[-0.02em]">ORBIT</span>
              </Link>

              <div className="hidden items-center gap-9 text-[15px] text-orbit-cream/55 md:flex">
                {NAV_LINKS.map(([label, href]) => (
                  <a key={href} href={href} className="transition-colors hover:text-orbit-cream">
                    {label}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Link to="/login" data-testid="nav-signin" className="hidden sm:block">
                  <Button
                    variant="ghost"
                    className="h-9 rounded-full px-4 text-sm text-orbit-cream/70 hover:bg-white/10 hover:text-orbit-cream"
                  >
                    Sign in
                  </Button>
                </Link>
                <Link to="/register" data-testid="nav-getstarted">
                  <Button className="h-9 rounded-full bg-orbit-cream px-5 text-sm font-medium text-orbit-ink hover:bg-white">
                    Get started
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  className="grid h-9 w-9 place-items-center rounded-full text-orbit-cream/70 transition-colors hover:bg-white/10 hover:text-orbit-cream md:hidden"
                >
                  {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
              </div>
            </nav>
          </div>

          {menuOpen && (
            <div className="h-[calc(100dvh-68px)] bg-orbit-ink/95 backdrop-blur-2xl md:hidden">
              {NAV_LINKS.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-white/[0.07] px-6 py-5 text-xl text-orbit-cream/80"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="block border-b border-white/[0.07] px-6 py-5 text-xl text-orbit-cream/80"
              >
                Sign in
              </Link>
            </div>
          )}
        </header>

        {/* HERO — owns the live voice demo */}
        <HeroStage />

        {/* TRUST STRIP — capabilities, not borrowed logos */}
        <section className="border-y border-white/[0.07] bg-orbit-surface py-5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 text-[13px] uppercase tracking-[0.16em] text-orbit-cream/35 lg:px-10">
            <span>Phone + WhatsApp</span>
            <span className="hidden sm:inline">·</span>
            <span>Live business data</span>
            <span className="hidden sm:inline">·</span>
            <span>Managed onboarding</span>
            <span className="hidden sm:inline">·</span>
            <span>India-first</span>
          </div>
        </section>

        {/* PRODUCT */}
        <section id="product" className="border-b border-white/[0.07] py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <span className="text-[13px] uppercase tracking-[0.16em] text-orbit-cream/35">
                  Meet your AI employee
                </span>
                <h2 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                  Not a chatbot with a phone number. An employee.
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-cream/55">
                  ORBIT configures a dedicated AI employee for your business — trained on your
                  services, policies and personality, connected to your live systems, and moved
                  through a controlled lifecycle so you go live with confidence, not hope.
                </p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Draft → Live", "Every employee is drafted, tested and approved before it answers a real customer."],
                ["Your brand's voice", "Warm, natural Indian-English, tuned to how your business actually speaks."],
                ["Fully managed", "Prompts, knowledge and tools are handled by the ORBIT team. Nothing technical for you."],
                ["Every call captured", "Transcripts, summaries and outcomes, neatly organised in one place."],
              ].map(([title, desc], i) => (
                <Reveal delay={i * 0.06} key={title}>
                  <div className="glass-frost h-full rounded-3xl p-7">
                    <div className="font-display text-lg font-semibold tracking-tight">{title}</div>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-cream/50">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* VERTICALS */}
        <section id="verticals" className="border-b border-white/[0.07] py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <span className="text-[13px] uppercase tracking-[0.16em] text-orbit-cream/35">
                  Built for your business
                </span>
                <h2 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                  One platform. An AI employee for every business.
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-cream/55">
                  ORBIT isn't industry software — it's a platform. Configure an AI employee for
                  whatever your business does. Hotels are simply where we went live first.
                </p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VERTICALS.map((v, i) => (
                <Reveal delay={i * 0.05} key={v.industry}>
                  <div className="group h-full rounded-3xl border border-white/[0.07] bg-white/[0.025] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.05]">
                    <div className="flex items-start justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.07] text-orbit-cream transition-colors group-hover:bg-orbit-gold group-hover:text-orbit-ink">
                        <v.icon className="h-5 w-5" />
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-orbit-cream/30">
                        {v.tag}
                      </span>
                    </div>
                    <div className="mt-6 font-display text-xl font-semibold tracking-tight">
                      {v.industry}
                    </div>
                    <div className="mt-1 text-[14px] text-orbit-gold/80">
                      {v.person} — {v.role}
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-cream/45">{v.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CHANNELS */}
        <section id="channels" className="border-b border-white/[0.07] py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <h2 className="max-w-2xl font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                Where your customers already are.
              </h2>
            </Reveal>

            <div className="mt-16 grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="glass-frost h-full rounded-[28px] p-10">
                  <span className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-orbit-cream text-orbit-ink">
                    <Phone className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">Phone</h3>
                  <p className="mt-4 text-[16px] leading-relaxed text-orbit-cream/55">
                    Connect an Indian phone number and route inbound and outbound calls straight to
                    your AI employee. Natural conversation, zero hold music.
                  </p>
                  <div className="mt-7 text-[14px] text-orbit-cream/35">
                    Real-time voice · call recordings · transcripts
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="glass-frost h-full rounded-[28px] p-10">
                  <span className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-orbit-live text-orbit-ink">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-2xl font-semibold tracking-tight">WhatsApp</h3>
                  <p className="mt-4 text-[16px] leading-relaxed text-orbit-cream/55">
                    ORBIT handles the Meta and BSP setup for you. You see connection status and your
                    assigned AI employee — nothing technical to manage.
                  </p>
                  <div className="mt-7 inline-flex rounded-full border border-orbit-gold/25 bg-orbit-gold/10 px-3.5 py-1.5 text-[13px] text-orbit-gold">
                    Action Required states are completed by our team
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="border-b border-white/[0.07] bg-orbit-surface py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <span className="text-[13px] uppercase tracking-[0.16em] text-orbit-cream/35">
                  The ORBIT dashboard
                </span>
                <h2 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                  One calm control room.
                </h2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-cream/55">
                  Your team sees only what matters — AI employees, channels, conversations and
                  usage. The technical machinery stays invisible.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative mt-16">
                <div className="absolute inset-x-12 -top-6 h-40 rounded-full bg-orbit-gold/15 blur-[90px]" />
                <div className="relative rounded-[26px] border border-white/10 bg-white/[0.03] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
                  <div className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#0B0B0F]">
                    <div className="grid min-h-[380px] grid-cols-12">
                      <div className="col-span-3 hidden border-r border-white/[0.07] p-5 md:block">
                        <div className="mb-8 flex items-center gap-2">
                          <OrbitLogo className="h-[18px] w-[18px] text-orbit-cream/80" />
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
                          {[["Conversations", "128"], ["Call minutes", "342"], ["AI employees", "1"], ["Channels", "2"]].map(
                            ([l, v]) => (
                              <div
                                key={l}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4"
                              >
                                <div className="font-display text-2xl font-semibold">{v}</div>
                                <div className="mt-1 text-xs text-orbit-cream/35">{l}</div>
                              </div>
                            )
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {[["Room booking enquiry", "2m 23s"], ["Wake-up call request", "0m 51s"], ["Restaurant reservation", "1m 44s"]].map(
                            ([t, d]) => (
                              <div
                                key={t}
                                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-orbit-live/15 text-orbit-live">
                                    <Phone className="h-4 w-4" />
                                  </span>
                                  <span className="text-sm">{t}</span>
                                </div>
                                <span className="text-xs text-orbit-cream/35">{d}</span>
                              </div>
                            )
                          )}
                        </div>
                        <p className="mt-5 text-[11px] uppercase tracking-[0.14em] text-orbit-cream/25">
                          Illustrative preview
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* LIVE DATA */}
        <section className="border-b border-white/[0.07] py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <span className="text-[13px] uppercase tracking-[0.16em] text-orbit-cream/35">
                  More than a chatbot
                </span>
                <h2 className="mt-5 font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                  It doesn't guess. It knows.
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-cream/55">
                  ORBIT connects securely to your existing systems, so your AI employee answers from
                  real information — not a stale script. Nothing connected yet? It stays in a clearly
                  limited informational mode instead of making things up.
                </p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-4 md:grid-cols-3">
              {LIVE_POINTS.map((p, i) => (
                <Reveal delay={i * 0.08} key={p.title}>
                  <div className="glass-frost h-full rounded-3xl p-8">
                    <span className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.07] text-orbit-gold">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{p.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-cream/50">{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section id="security" className="border-b border-white/[0.07] py-28 lg:py-36">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <h2 className="max-w-2xl font-display text-[clamp(2.2rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-gradient-cream">
                Built so the boring parts never bite you.
              </h2>
            </Reveal>
            <div className="mt-16 grid gap-4 lg:grid-cols-3">
              {SECURITY.map(([Icon, t, d], i) => (
                <Reveal delay={i * 0.08} key={t}>
                  <div className="glass-frost h-full rounded-3xl p-8">
                    <span className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.07] text-orbit-cream">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{t}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-cream/50">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PROOF */}
        <section className="border-b border-white/[0.07] bg-orbit-surface py-28 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <h2 className="text-center font-display text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-gradient-cream">
                Everyday calls. Real outcomes.
              </h2>
            </Reveal>
            <div className="mt-14 grid divide-y divide-white/[0.07] md:grid-cols-3 md:divide-x md:divide-y-0">
              {PROOF.map(([title, desc], i) => (
                <Reveal delay={i * 0.08} key={title}>
                  <div className="px-2 py-8 text-center md:px-8 md:py-2">
                    <div className="font-display text-2xl font-semibold tracking-tight">{title}</div>
                    <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-orbit-cream/45">
                      {desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden py-32 lg:py-40">
          <div aria-hidden="true" className="absolute inset-0">
            <div className="animate-orbit-drift absolute left-1/2 top-1/2 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(228,184,113,0.22),transparent_62%)] blur-3xl" />
            {/* The mark, oversized, as brand texture rather than decoration. */}
            <OrbitRing className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 text-orbit-cream/[0.045]" />
            <div className="grain absolute inset-0 opacity-50" />
          </div>
          <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[clamp(2.4rem,5.5vw,4.4rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-gradient-cream"
            >
              Put your business on ORBIT.
            </motion.h2>
            <Reveal delay={0.08}>
              <p className="mx-auto mt-7 max-w-lg text-[17px] leading-relaxed text-orbit-cream/55">
                Onboard your business, connect your channels and systems, and go live with an AI
                employee your customers will actually enjoy talking to.
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
                    className="h-[54px] rounded-2xl border-white/15 bg-transparent px-8 text-[15px] text-orbit-cream hover:bg-white/10 hover:text-orbit-cream"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/[0.07] py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 md:flex-row lg:px-10">
            <div className="flex items-center gap-2.5">
              <OrbitLogo className="h-[22px] w-[22px] text-orbit-cream" />
              <span className="font-display font-semibold tracking-[-0.02em]">ORBIT</span>
            </div>
            <p className="text-sm text-orbit-cream/35">
              AI employees for businesses · India-first
            </p>
            <div className="flex gap-6 text-sm text-orbit-cream/45">
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
