import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Orbit, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Full-screen first-run flow — deliberately NOT inside DashboardLayout (no sidebar,
// no nav). Two short screens: get the one thing ORBIT genuinely can't proceed
// without (the owner's contact profile), then a "you're set" moment that explains
// what happens next before handing off to the real dashboard. DashboardLayout.jsx
// is what redirects a fresh signup here in the first place — this page only ever
// needs to get the owner from "just signed up" to "inside the dashboard".
function StepDots({ step }) {
  return (
    <div className="flex items-center gap-1.5" data-testid="onboarding-step-dots">
      {[0, 1].map((i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-zinc-900" : "w-1.5 bg-zinc-200"}`} />
      ))}
    </div>
  );
}

export default function OnboardingWelcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ contact_phone: "", contact_email: "", address: "" });

  useEffect(() => {
    api.get("/tenant/profile").then((r) => {
      const p = r.data?.profile || {};
      setForm({
        contact_phone: p.contact_phone || "",
        contact_email: p.contact_email || "",
        address: p.address || "",
      });
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const continueToConfirmation = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/tenant/profile", form);
      setStep(1);
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const goToDashboard = () => navigate("/dashboard", { replace: true });

  if (!loaded) {
    return (
      <div className="min-h-screen grid place-items-center bg-white" data-testid="onboarding-loading">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white px-6" data-testid="onboarding-welcome">
      <div className="max-w-sm w-full py-12">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white grid place-items-center"><Orbit className="w-5 h-5" strokeWidth={1.6} /></div>
          <span className="font-display text-lg font-semibold">ORBIT</span>
        </div>

        <StepDots step={step} />

        {step === 0 ? (
          <form onSubmit={continueToConfirmation} className="mt-6 space-y-5" data-testid="onboarding-profile-form">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">A few details about your business</h1>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                So our team can reach you and get your AI employee set up correctly.
              </p>
            </div>
            <div>
              <Label className="text-sm">Contact phone</Label>
              <Input value={form.contact_phone} onChange={set("contact_phone")} required data-testid="onboarding-phone"
                placeholder="+91 …" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            <div>
              <Label className="text-sm">Contact email</Label>
              <Input type="email" value={form.contact_email} onChange={set("contact_email")} required data-testid="onboarding-email"
                placeholder="you@business.in" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            <div>
              <Label className="text-sm">Business address</Label>
              <Input value={form.address} onChange={set("address")} required data-testid="onboarding-address"
                placeholder="Street, City, PIN" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            <Button type="submit" disabled={saving} data-testid="onboarding-continue"
              className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-5" data-testid="onboarding-confirmation">
            <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center">
              <CheckCircle2 className="w-6 h-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">You're all set for now</h1>
              <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                ORBIT is now setting up your AI employee, phone number and WhatsApp. This usually takes 1–2 business
                days — we'll let you know the moment it's ready. Meanwhile, feel free to explore your dashboard.
              </p>
            </div>
            <Button onClick={goToDashboard} data-testid="onboarding-go-to-dashboard"
              className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800">
              Go to your dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
