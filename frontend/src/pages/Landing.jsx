import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Lenis from "lenis";
import {
  Orbit, Phone, MessageCircle, Mic, ShieldCheck, ArrowRight, Check,
  IndianRupee, Lock, PhoneCall, Sparkles, Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParticleField } from "@/components/ParticleField";
import { Reveal } from "@/components/Reveal";

const IMG = {
  reception:
    "https://images.unsplash.com/photo-1759038085950-1234ca8f5fed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwaG90ZWwlMjBsb2JieSUyMHJlY2VwdGlvbiUyMGRlc2t8ZW58MHx8fHwxNzg2OTkxMjAxfDA&ixlib=rb-4.1.0&q=85",
  architecture:
    "https://images.pexels.com/photos/19344317/pexels-photo-19344317.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

const OrbitMark = ({ className = "w-9 h-9" }) => (
  <div className={`grid place-items-center rounded-xl bg-zinc-900 text-white ${className}`}>
    <Orbit className="w-5 h-5" strokeWidth={1.6} />
  </div>
);

const FloatChip = ({ children, className = "", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 18, scale: 0.96 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    className={`absolute glass soft-shadow rounded-2xl px-4 py-3 ${className}`}
  >
    {children}
  </motion.div>
);

export default function Landing() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
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

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="glass border-b border-black/5">
          <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5" data-testid="nav-logo">
              <OrbitMark className="w-8 h-8" />
              <span className="font-display text-lg font-semibold tracking-tight">ORBIT</span>
            </Link>
            <div className="hidden md:flex items-center gap-9 text-sm text-zinc-600">
              <a href="#product" className="hover:text-zinc-900 transition-colors">Product</a>
              <a href="#channels" className="hover:text-zinc-900 transition-colors">Channels</a>
              <a href="#security" className="hover:text-zinc-900 transition-colors">Security</a>
              <a href="#outcome" className="hover:text-zinc-900 transition-colors">Why ORBIT</a>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/login" data-testid="nav-signin">
                <Button variant="ghost" className="rounded-full text-sm h-9 px-4">Sign in</Button>
              </Link>
              <Link to="/register" data-testid="nav-getstarted">
                <Button className="rounded-full text-sm h-9 px-5 bg-zinc-900 hover:bg-zinc-800">Get started</Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-40 pb-32 hero-radial">
        <div className="absolute inset-0 grain pointer-events-none" />
        <div className="absolute inset-0 max-w-6xl mx-auto"><ParticleField /></div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs text-zinc-600 mb-7">
                  <Sparkles className="w-3.5 h-3.5" /> AI employees for India's finest hotels
                </div>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[0.98] tracking-tighter text-balance">
                  The AI front desk that never sleeps.
                </h1>
              </Reveal>
              <Reveal delay={0.12}>
                <p className="mt-7 text-lg text-zinc-600 leading-relaxed max-w-xl">
                  ORBIT gives your hotel a voice-perfect AI employee that answers every phone call and
                  WhatsApp — booking rooms, handling requests and delighting guests, 24/7, in your brand's voice.
                </p>
              </Reveal>
              <Reveal delay={0.18}>
                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link to="/register" data-testid="hero-getstarted">
                    <Button className="rounded-full h-12 px-7 text-base bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] transition-transform">
                      Get started <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                  </Link>
                  <Link to="/login" data-testid="hero-demo">
                    <Button variant="outline" className="rounded-full h-12 px-7 text-base border-black/15 hover:bg-zinc-50">
                      View live dashboard
                    </Button>
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={0.24}>
                <div className="mt-9 flex items-center gap-6 text-sm text-zinc-500">
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-zinc-900" /> Managed onboarding</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-zinc-900" /> INR + GST billing</span>
                  <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-zinc-900" /> Strict data isolation</span>
                </div>
              </Reveal>
            </div>

            {/* Hero visual */}
            <div className="lg:col-span-5 relative h-[440px] hidden lg:block">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 rounded-[28px] bg-gradient-to-b from-zinc-50 to-white border border-black/5 soft-shadow-lg grid place-items-center overflow-hidden"
              >
                <div className="relative w-40 h-40">
                  <div className="absolute inset-0 rounded-full border border-zinc-200 animate-float-slow" />
                  <div className="absolute inset-4 rounded-full border border-zinc-200" />
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-20 h-20 rounded-full bg-zinc-900 grid place-items-center text-white animate-float">
                      <Mic className="w-8 h-8" strokeWidth={1.4} />
                    </div>
                  </div>
                </div>
              </motion.div>

              <FloatChip className="left-0 top-6 animate-float" delay={0.5}>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 grid place-items-center"><PhoneCall className="w-4 h-4" /></span>
                  <div className="leading-tight">
                    <div className="text-xs text-zinc-400">Incoming call</div>
                    <div className="text-sm font-medium">+91 98•• answered</div>
                  </div>
                </div>
              </FloatChip>

              <FloatChip className="right-0 top-24 animate-float-slow" delay={0.7}>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-zinc-900 text-white grid place-items-center text-[11px] font-semibold">A</span>
                  <div className="leading-tight">
                    <div className="text-sm font-medium">Aria</div>
                    <div className="text-xs text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live</div>
                  </div>
                </div>
              </FloatChip>

              <FloatChip className="left-4 bottom-4 animate-float" delay={0.9}>
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 grid place-items-center"><MessageCircle className="w-4 h-4" /></span>
                  <div className="leading-tight">
                    <div className="text-xs text-zinc-400">WhatsApp</div>
                    <div className="text-sm font-medium">Booking confirmed</div>
                  </div>
                </div>
              </FloatChip>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT / STORYTELLING */}
      <section id="product" className="py-28 border-t border-black/5 bg-zinc-50/60">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <Reveal>
            <div className="relative">
              <div className="rounded-[28px] overflow-hidden border border-black/5 soft-shadow-lg">
                <img src={IMG.reception} alt="Hotel reception" className="w-full h-[460px] object-cover" loading="lazy" />
              </div>
              <FloatChip className="-right-4 top-10 max-w-[240px] animate-float-slow">
                <div className="text-xs text-zinc-400 mb-1">Aria · transcript</div>
                <div className="text-sm text-zinc-800 leading-snug">"A Deluxe King is available Saturday at ₹14,500 + GST. Shall I hold it for you?"</div>
              </FloatChip>
            </div>
          </Reveal>
          <div>
            <Reveal><span className="text-sm font-medium text-zinc-400">Meet your AI employee</span></Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
                A concierge that knows your hotel by heart.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 text-zinc-600 leading-relaxed">
                ORBIT configures a dedicated AI employee for your property — trained on your rooms, tariffs,
                policies and personality. It moves through a controlled lifecycle so you're always live with
                confidence.
              </p>
            </Reveal>
            <div className="mt-8 grid sm:grid-cols-2 gap-4">
              {[
                ["Draft → Live lifecycle", "Every agent is drafted, tested and approved before going live."],
                ["Your brand's voice", "Warm, natural Indian-English voice tuned to your property."],
                ["Fully managed", "Prompts, knowledge and tools handled by the ORBIT team."],
                ["Every call captured", "Transcripts, summaries and recordings, neatly organised."],
              ].map(([t, d], i) => (
                <Reveal delay={0.12 + i * 0.05} key={t}>
                  <div className="rounded-2xl border border-black/5 bg-white p-5 h-full">
                    <div className="text-sm font-semibold">{t}</div>
                    <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CHANNELS */}
      <section id="channels" className="py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="max-w-2xl">
              <span className="text-sm font-medium text-zinc-400">Channels</span>
              <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
                Where your guests already are.
              </h2>
            </div>
          </Reveal>
          <div className="mt-14 grid lg:grid-cols-2 gap-6">
            <Reveal>
              <div className="rounded-[28px] border border-black/5 bg-gradient-to-b from-white to-zinc-50 p-10 h-full soft-shadow">
                <span className="w-12 h-12 rounded-2xl bg-zinc-900 text-white grid place-items-center mb-6"><Phone className="w-5 h-5" /></span>
                <h3 className="font-display text-2xl font-semibold">Phone — powered by Exotel</h3>
                <p className="mt-3 text-zinc-600 leading-relaxed">
                  Connect an Indian phone number and route inbound and outbound calls straight to your AI
                  employee. Natural conversation, zero hold music.
                </p>
                <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
                  <Waves className="w-4 h-4" /> Real-time voice · call recordings · transcripts
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-[28px] border border-black/5 bg-gradient-to-b from-white to-zinc-50 p-10 h-full soft-shadow">
                <span className="w-12 h-12 rounded-2xl bg-green-600 text-white grid place-items-center mb-6"><MessageCircle className="w-5 h-5" /></span>
                <h3 className="font-display text-2xl font-semibold">WhatsApp — managed onboarding</h3>
                <p className="mt-3 text-zinc-600 leading-relaxed">
                  ORBIT handles the Meta &amp; BSP setup for you. You'll see connection status and your assigned
                  AI employee — nothing technical to manage.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-medium">
                  Action Required states are completed by our team
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW */}
      <section className="py-28 bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-sm font-medium text-zinc-400">The ORBIT dashboard</span>
              <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold tracking-tight">
                One calm control room.
              </h2>
              <p className="mt-5 text-zinc-400 leading-relaxed">
                Your team sees only what matters — AI employees, channels, conversations and usage. The
                ElevenLabs machinery stays invisible.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-14 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 soft-shadow-lg">
              <div className="rounded-2xl bg-zinc-900 border border-white/5 overflow-hidden">
                <div className="grid grid-cols-12 min-h-[360px]">
                  <div className="col-span-3 border-r border-white/5 p-5 hidden md:block">
                    <div className="flex items-center gap-2 mb-8"><OrbitMark className="w-7 h-7" /><span className="text-sm font-medium">Taj Palace</span></div>
                    {["Overview", "AI Employees", "Channels", "Conversations", "Customization", "Settings"].map((n, i) => (
                      <div key={n} className={`px-3 py-2 rounded-lg text-sm mb-1 ${i === 0 ? "bg-white/10 text-white" : "text-zinc-500"}`}>{n}</div>
                    ))}
                  </div>
                  <div className="col-span-12 md:col-span-9 p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[["Conversations", "128"], ["Call minutes", "342"], ["AI employees", "1"], ["Channels", "2"]].map(([l, v]) => (
                        <div key={l} className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                          <div className="text-2xl font-display font-semibold">{v}</div>
                          <div className="text-xs text-zinc-500 mt-1">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      {[["Room booking enquiry", "2m 23s"], ["Wake-up call request", "0m 51s"], ["Restaurant reservation", "1m 44s"]].map(([t, d]) => (
                        <div key={t} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 grid place-items-center"><Phone className="w-4 h-4" /></span>
                            <span className="text-sm">{t}</span>
                          </div>
                          <span className="text-xs text-zinc-500">{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security" className="py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-3 gap-6">
          {[
            [Lock, "Secrets stay server-side", "ElevenLabs, Exotel, WhatsApp and Razorpay keys are never sent to the browser or exposed to customers."],
            [ShieldCheck, "Strict tenant isolation", "Your data is resolved from your authenticated session — never from the request. Cross-tenant access is impossible by design."],
            [IndianRupee, "Utility-style INR billing", "Usage-based invoicing with configurable rates, ORBIT markup and GST. Idempotent and reconciled before every invoice."],
          ].map(([Icon, t, d], i) => (
            <Reveal delay={i * 0.08} key={t}>
              <div className="rounded-[24px] border border-black/5 bg-white p-8 h-full soft-shadow">
                <span className="w-11 h-11 rounded-2xl bg-zinc-100 text-zinc-900 grid place-items-center mb-5"><Icon className="w-5 h-5" /></span>
                <h3 className="font-display text-xl font-semibold">{t}</h3>
                <p className="mt-3 text-sm text-zinc-500 leading-relaxed">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* OUTCOME */}
      <section id="outcome" className="py-28 bg-zinc-50/60 border-y border-black/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <Reveal><span className="text-sm font-medium text-zinc-400">The outcome</span></Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
                Never miss a booking again.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 text-zinc-600 leading-relaxed">
                Every unanswered call is a lost guest. ORBIT answers instantly, at any hour, in every language
                your guests speak — so your front desk can focus on the people in front of them.
              </p>
            </Reveal>
            <div className="mt-10 grid grid-cols-3 gap-6">
              {[["24/7", "always answering"], ["100%", "calls captured"], ["₹", "GST-ready invoices"]].map(([v, l]) => (
                <Reveal delay={0.14} key={l}>
                  <div>
                    <div className="font-display text-4xl font-semibold">{v}</div>
                    <div className="mt-1 text-sm text-zinc-500">{l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <Reveal delay={0.08}>
            <div className="rounded-[28px] overflow-hidden border border-black/5 soft-shadow-lg">
              <img src={IMG.architecture} alt="Luxury hotel architecture" className="w-full h-[440px] object-cover" loading="lazy" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="rounded-[32px] bg-zinc-950 text-white px-8 py-16 md:px-16 text-center relative overflow-hidden">
              <div className="absolute inset-0 grain opacity-40" />
              <h2 className="relative font-display text-4xl md:text-5xl font-semibold tracking-tight text-balance">
                Put your hotel on ORBIT.
              </h2>
              <p className="relative mt-5 text-zinc-400 max-w-xl mx-auto">
                Onboard your property, connect your channels and go live with an AI employee your guests will love.
              </p>
              <div className="relative mt-9 flex flex-wrap justify-center gap-3">
                <Link to="/register" data-testid="cta-getstarted">
                  <Button className="rounded-full h-12 px-8 bg-white text-zinc-900 hover:bg-zinc-200 active:scale-[0.98] transition-transform">
                    Get started <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="rounded-full h-12 px-8 border-white/20 bg-transparent text-white hover:bg-white/10">
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/5 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <OrbitMark className="w-7 h-7" />
            <span className="font-display font-semibold">ORBIT</span>
          </div>
          <p className="text-sm text-zinc-500">AI employees for hotels · India-first · Built on ElevenLabs</p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">AI disclosure</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
