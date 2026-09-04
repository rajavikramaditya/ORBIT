import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Orbit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

const IMG =
  "https://images.unsplash.com/photo-1759038085950-1234ca8f5fed?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2Mzl8MHwxfHNlYXJjaHwyfHxwcmVtaXVtJTIwaG90ZWwlMjBsb2JieSUyMHJlY2VwdGlvbiUyMGRlc2t8ZW58MHx8fHwxNzg2OTkxMjAxfDA&ixlib=rb-4.1.0&q=85";

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"/></svg>
);

// Google Sign-In is enabled via REACT_APP_ENABLE_GOOGLE_LOGIN=true.
const GOOGLE_LOGIN_ENABLED = process.env.REACT_APP_ENABLE_GOOGLE_LOGIN === "true";

export default function Register() {
  const { user, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", hotel_name: "", business_type: "hotel", email: "", password: "",
    contact_phone: "", address: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.role === "platform_admin" ? "/admin" : "/dashboard"} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register(form);
    setLoading(false);
    // Straight to the one-time "you're all set" confirmation, not the dashboard —
    // the profile is already complete from this form, so OnboardingWelcome shows
    // only that reassurance screen (no second data-entry page) before /dashboard.
    if (res.ok) navigate("/onboarding", { replace: true });
    else setError(res.error);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <Link to="/" className="flex items-center gap-2.5 mb-12" data-testid="register-logo">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white grid place-items-center"><Orbit className="w-5 h-5" strokeWidth={1.6} /></div>
          <span className="font-display text-lg font-semibold">ORBIT</span>
        </Link>
        <div className="max-w-sm w-full">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Onboard your business</h1>
          <p className="mt-2 text-zinc-500 text-sm">Create your workspace. Our team completes managed setup.</p>

          {GOOGLE_LOGIN_ENABLED && (
            <>
              <Button type="button" variant="outline" onClick={googleLogin} data-testid="register-google-btn"
                className="mt-8 w-full h-11 rounded-xl border-black/10 gap-2.5 hover:bg-zinc-50">
                <GoogleIcon /> Continue with Google
              </Button>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px bg-zinc-200 flex-1" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="h-px bg-zinc-200 flex-1" />
              </div>
            </>
          )}

          <form onSubmit={submit} className={`space-y-4 ${GOOGLE_LOGIN_ENABLED ? "" : "mt-8"}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Your name</Label>
                <Input value={form.name} onChange={set("name")} required data-testid="register-name"
                  placeholder="Priya Sharma" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
              </div>
              <div>
                <Label className="text-sm">Business / Hotel name</Label>
                <Input value={form.hotel_name} onChange={set("hotel_name")} required data-testid="register-hotel"
                  placeholder="Business or Property name" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
              </div>
            </div>
            <div>
              <Label className="text-sm">Business type</Label>
              <Select value={form.business_type} onValueChange={(v) => setForm({ ...form, business_type: v })}>
                <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" data-testid="register-business-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hotel">Hotel</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="salon">Salon</SelectItem>
                  <SelectItem value="clinic">Clinic</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input type="email" value={form.email} onChange={set("email")} required data-testid="register-email"
                placeholder="you@business.in" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Contact phone</Label>
                <Input value={form.contact_phone} onChange={set("contact_phone")} required data-testid="register-phone"
                  placeholder="+91 …" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
              </div>
              <div>
                <Label className="text-sm">Business address</Label>
                <Input value={form.address} onChange={set("address")} required data-testid="register-address"
                  placeholder="Street, City, PIN" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
              </div>
            </div>

            <div>
              <Label className="text-sm">Password</Label>
              <Input type="password" value={form.password} onChange={set("password")} required data-testid="register-password"
                placeholder="At least 6 characters" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="register-error">{error}</p>}
            <Button type="submit" disabled={loading} data-testid="register-submit"
              className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create workspace"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-zinc-500">
            Already have an account? <Link to="/login" className="text-zinc-900 font-medium hover:underline" data-testid="register-to-login">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block relative">
        <img src={IMG} alt="Business workspace" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-display text-2xl font-medium leading-snug">Your AI employee, live in days.</p>
          <p className="mt-3 text-white/70 text-sm">Managed onboarding, strict data isolation, live business data.</p>
        </div>
      </div>
    </div>
  );
}
