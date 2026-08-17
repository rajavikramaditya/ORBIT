import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Orbit, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const IMG =
  "https://images.pexels.com/photos/19344317/pexels-photo-19344317.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=900&w=940";

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.44 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 6.68 9.14 4.75 12 4.75Z"/></svg>
);

export default function Login() {
  const { user, login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={user.role === "platform_admin" ? "/admin" : "/dashboard"} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate(res.user.role === "platform_admin" ? "/admin" : "/dashboard", { replace: true });
    else setError(res.error);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <Link to="/" className="flex items-center gap-2.5 mb-14" data-testid="login-logo">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white grid place-items-center"><Orbit className="w-5 h-5" strokeWidth={1.6} /></div>
          <span className="font-display text-lg font-semibold">ORBIT</span>
        </Link>
        <div className="max-w-sm w-full">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-zinc-500 text-sm">Sign in to your ORBIT workspace.</p>

          <Button
            type="button"
            variant="outline"
            onClick={googleLogin}
            data-testid="login-google-btn"
            className="mt-8 w-full h-11 rounded-xl border-black/10 gap-2.5 hover:bg-zinc-50"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="flex items-center gap-4 my-6">
            <div className="h-px bg-zinc-200 flex-1" />
            <span className="text-xs text-zinc-400">or</span>
            <div className="h-px bg-zinc-200 flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                data-testid="login-email" placeholder="you@hotel.in" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            <div>
              <Label htmlFor="password" className="text-sm">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                data-testid="login-password" placeholder="••••••••" className="mt-1.5 h-11 rounded-xl bg-zinc-50 border-black/10" />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
            <Button type="submit" disabled={loading} data-testid="login-submit"
              className="w-full h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-zinc-500">
            New to ORBIT? <Link to="/register" className="text-zinc-900 font-medium hover:underline" data-testid="login-to-register">Onboard your business</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block relative">
        <img src={IMG} alt="Luxury hotel" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-display text-2xl font-medium leading-snug">"ORBIT answers every call, so we never lose a guest."</p>
          <p className="mt-3 text-white/70 text-sm">Premium hospitality, powered by AI employees.</p>
        </div>
      </div>
    </div>
  );
}
