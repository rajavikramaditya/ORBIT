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

/**
 * The page runs LIGHT with three dark bands — hero, dashboard, and the closing
 * CTA. That rhythm, not a dark theme, is what makes it feel considered: the
 * dark sections only land because most of the page is paper-white around them.
 * Photography does the rest of the work; gradients alone read as cheap.
 */

// Unsplash, free licence.
const IMG = {
  reception:
    "https://images.unsplash.com/photo-1759038085950-1234ca8f5fed?auto=format&fit=crop&w=1400&q=80",
  lobby:
    "https://images.unsplash.com/photo-1763560705345-5aed55f99c8f?auto=format&fit=crop&w=1400&q=80",
  restaurant:
    "https://images.unsplash.com/photo-1636405189493-181ecf851006?auto=format&fit=crop&w=1200&q=80",
  evening:
    "https://images.unsplash.com/photo-1726873800099-53f5496281e0?auto=format&fit=crop&w=2000&q=80",
};

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
    className={`font-display text-[clamp(2.1rem,4.4vw,3.6rem)] font-semibold leading-[1] tracking-[-0.035em] ${
      onDark ? "text-orbit-cream" : "text-orbit-text"
    } ${className}`}
  >
    {children}
  </h2>
);

export default function Landing() {
  // The nav sits transparent on the hero photo, then turns to paper once the
  // dark band is behind it — otherwise cream-on-white text disappears.
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
        {/* NAV — adapts from the dark hero to the light body */}
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
                  navSolid ? "text-orbit-text/60" : "text-orbit-cream/65"
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
                        : "text-orbit-cream/75 hover:bg-white/10 hover:text-orbit-cream"
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
                    navSolid ? "text-orbit-text/70 hover:bg-black/5" : "text-orbit-cream/75 hover:bg-white/10"
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

        {/* ── DARK BAND 1: hero + live demo ── */}
        <HeroStage />

        {/* Capability strip — honest, no borrowed client logos */}
        <section className="border-b border-black/[0.06] bg-orbit-sand py-5">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 text-[12px] uppercase tracking-[0.18em] text-orbit-text/40 lg:px-10">
            <span>Phone + WhatsApp</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Live business data</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Managed onboarding</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>India-first</span>
          </div>
        </section>

        {/* PRODUCT — light */}
        <section id="product" className="bg-orbit-paper py-24 lg:py-32">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2 lg:gap-20 lg:px-10">
            <Reveal>
              <div className="relative">
                <img
                  src={IMG.reception}
                  alt="A hotel reception desk"
                  loading="lazy"
                  className="h-[380px] w-full rounded-[28px] object-cover shadow-[0_30px_80px_rgba(20,20,26,0.16)] lg:h-[460px]"
                />
                <div className="absolute -right-3 bottom-8 max-w-[250px] rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-[0_16px_50px_rgba(20,20,26,0.14)] backdrop-blur-xl lg:-right-8">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-orbit-goldink">
                    Riya · transcript
                  </div>
                  <p className="mt-2 text-[14px] leading-snug text-orbit-text/80">
                    “A Deluxe King is available Saturday at ₹14,500 + GST. Shall I hold it for you?”
                  </p>
                </div>
              </div>
            </Reveal>

            <div>
              <Reveal>
                <Eyebrow>Meet your AI employee</Eyebrow>
              </Reveal>
              <Reveal delay={0.05}>
                <H2 className="mt-5">Not a chatbot with a phone number. An employee.</H2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-orbit-text/60">
                  ORBIT configures a dedicated AI employee for your business — trained on your
                  services, policies and personality, connected to your live systems, and moved
                  through a controlled lifecycle so you go live with confidence, not hope.
                </p>
              </Reveal>

              <div className="mt-10 grid gap-3 sm:grid-cols-2">
                {[
                  ["Draft → Live", "Drafted, tested and approved before it answers a real customer."],
                  ["Your brand's voice", "Warm, natural Indian-English, tuned to how you actually speak."],
                  ["Fully managed", "Prompts, knowledge and tools handled by the ORBIT team."],
                  ["Every call captured", "Transcripts, summaries and outcomes in one place."],
                ].map(([title, desc], i) => (
                  <Reveal delay={0.14 + i * 0.05} key={title}>
                    <div className="h-full rounded-2xl border border-black/[0.07] bg-orbit-sand p-5">
                      <div className="text-[15px] font-semibold">{title}</div>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-orbit-text/55">{desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* VERTICALS — light, soft */}
        <section id="verticals" className="border-y border-black/[0.06] bg-orbit-sand py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>Built for your business</Eyebrow>
                <H2 className="mt-5">One platform. An AI employee for every business.</H2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-text/60">
                  ORBIT isn't industry software — it's a platform. Configure an AI employee for
                  whatever your business does. Hotels are simply where we went live first.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VERTICALS.map((v, i) => (
                <Reveal delay={i * 0.05} key={v.industry}>
                  <div className="group h-full rounded-[24px] border border-black/[0.06] bg-white p-7 shadow-[0_4px_24px_rgba(20,20,26,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(20,20,26,0.10)]">
                    <div className="flex items-start justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orbit-text text-white transition-colors group-hover:bg-orbit-goldink">
                        <v.icon className="h-5 w-5" />
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-orbit-text/35">
                        {v.tag}
                      </span>
                    </div>
                    <div className="mt-6 font-display text-xl font-semibold tracking-tight">
                      {v.industry}
                    </div>
                    <div className="mt-1 text-[14px] text-orbit-goldink">
                      {v.person} — {v.role}
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-text/55">{v.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CHANNELS — light */}
        <section id="channels" className="bg-orbit-paper py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <H2 className="max-w-2xl">Where your customers already are.</H2>
            </Reveal>

            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              <Reveal>
                <div className="h-full overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_4px_24px_rgba(20,20,26,0.04)]">
                  <img
                    src={IMG.restaurant}
                    alt="A restaurant dining room in the evening"
                    loading="lazy"
                    className="h-52 w-full object-cover"
                  />
                  <div className="p-9">
                    <span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-orbit-text text-white">
                      <Phone className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-2xl font-semibold tracking-tight">Phone</h3>
                    <p className="mt-4 text-[16px] leading-relaxed text-orbit-text/60">
                      Connect an Indian phone number and route inbound and outbound calls straight
                      to your AI employee. Natural conversation, zero hold music.
                    </p>
                    <div className="mt-6 text-[14px] text-orbit-text/40">
                      Real-time voice · call recordings · transcripts
                    </div>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="h-full overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-[0_4px_24px_rgba(20,20,26,0.04)]">
                  <img
                    src={IMG.lobby}
                    alt="A hotel lobby seating area"
                    loading="lazy"
                    className="h-52 w-full object-cover"
                  />
                  <div className="p-9">
                    <span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-orbit-live text-white">
                      <MessageCircle className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-2xl font-semibold tracking-tight">WhatsApp</h3>
                    <p className="mt-4 text-[16px] leading-relaxed text-orbit-text/60">
                      ORBIT handles the Meta and BSP setup for you. You see connection status and
                      your assigned AI employee — nothing technical to manage.
                    </p>
                    <div className="mt-6 inline-flex rounded-full border border-orbit-goldink/25 bg-orbit-gold/15 px-3.5 py-1.5 text-[13px] text-orbit-goldink">
                      Action Required states are completed by our team
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── DARK BAND 2: the product itself ── */}
        <section className="bg-orbit-ink py-24 text-orbit-cream lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <Eyebrow onDark>The ORBIT dashboard</Eyebrow>
                <H2 onDark className="mt-5">One calm control room.</H2>
                <p className="mt-6 text-[17px] leading-relaxed text-orbit-cream/55">
                  Your team sees only what matters — AI employees, channels, conversations and
                  usage. The technical machinery stays invisible.
                </p>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="relative mt-14">
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
                                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-orbit-live/20 text-orbit-live">
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

        {/* LIVE DATA — light */}
        <section className="bg-orbit-paper py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <div className="max-w-3xl">
                <Eyebrow>More than a chatbot</Eyebrow>
                <H2 className="mt-5">It doesn't guess. It knows.</H2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-orbit-text/60">
                  ORBIT connects securely to your existing systems, so your AI employee answers from
                  real information — not a stale script. Nothing connected yet? It stays in a clearly
                  limited informational mode instead of making things up.
                </p>
              </div>
            </Reveal>

            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {LIVE_POINTS.map((p, i) => (
                <Reveal delay={i * 0.08} key={p.title}>
                  <div className="h-full rounded-[24px] border border-black/[0.06] bg-orbit-sand p-8">
                    <span className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-white text-orbit-goldink shadow-sm">
                      <p.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{p.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-text/55">{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SECURITY — light, soft */}
        <section id="security" className="border-y border-black/[0.06] bg-orbit-sand py-24 lg:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <H2 className="max-w-2xl">Built so the boring parts never bite you.</H2>
            </Reveal>
            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {SECURITY.map(([Icon, t, d], i) => (
                <Reveal delay={i * 0.08} key={t}>
                  <div className="h-full rounded-[24px] border border-black/[0.06] bg-white p-8 shadow-[0_4px_24px_rgba(20,20,26,0.04)]">
                    <span className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-orbit-text text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-xl font-semibold tracking-tight">{t}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-orbit-text/55">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PROOF — light */}
        <section className="bg-orbit-paper py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <Reveal>
              <H2 className="text-center">Everyday calls. Real outcomes.</H2>
            </Reveal>
            <div className="mt-14 grid divide-y divide-black/[0.07] md:grid-cols-3 md:divide-x md:divide-y-0">
              {PROOF.map(([title, desc], i) => (
                <Reveal delay={i * 0.08} key={title}>
                  <div className="px-2 py-8 text-center md:px-8 md:py-2">
                    <div className="font-display text-2xl font-semibold tracking-tight">{title}</div>
                    <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-orbit-text/55">
                      {desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── DARK BAND 3: closing CTA ── */}
        <section className="relative overflow-hidden py-28 lg:py-36">
          <div aria-hidden="true" className="absolute inset-0 bg-orbit-ink">
            <img
              src={IMG.evening}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(8,8,11,0.55),rgba(8,8,11,0.92))]" />
            <OrbitRing className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 text-orbit-cream/[0.06]" />
            <div className="grain absolute inset-0 opacity-40" />
          </div>

          <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-10">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[clamp(2.3rem,5.2vw,4.2rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-orbit-cream"
            >
              Put your business on ORBIT.
            </motion.h2>
            <Reveal delay={0.08}>
              <p className="mx-auto mt-7 max-w-lg text-[17px] leading-relaxed text-orbit-cream/60">
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
                    className="h-[54px] rounded-2xl border-white/20 bg-transparent px-8 text-[15px] text-orbit-cream hover:bg-white/10 hover:text-orbit-cream"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FOOTER — dark, continuous with the CTA above */}
        <footer className="bg-orbit-ink py-12 text-orbit-cream">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-6 md:flex-row lg:px-10">
            <div className="flex items-center gap-2.5">
              <OrbitLogo className="h-[22px] w-[22px] text-orbit-cream" />
              <span className="font-display font-semibold tracking-[-0.02em]">ORBIT</span>
            </div>
            <p className="text-sm text-orbit-cream/40">
              AI employees for businesses · India-first
            </p>
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
