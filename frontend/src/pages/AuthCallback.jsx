import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { exchangeGoogleTicket } = useAuth();
  const processed = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || window.location.hash;
    const ticketMatch = hash.match(/auth_ticket=([^&]+)/);
    const sessionMatch = hash.match(/session_id=([^&]+)/);
    const ticket = ticketMatch
      ? decodeURIComponent(ticketMatch[1])
      : sessionMatch
      ? decodeURIComponent(sessionMatch[1])
      : null;

    if (!ticket) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      try {
        const user = await exchangeGoogleTicket(ticket);
        window.history.replaceState(null, "", window.location.pathname);
        navigate(user.role === "platform_admin" ? "/admin" : "/dashboard", { replace: true });
      } catch (e) {
        setError("Sign-in failed. Please try again.");
        setTimeout(() => navigate("/login", { replace: true }), 1600);
      }
    })();
  }, [location.hash, exchangeGoogleTicket, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4" data-testid="auth-callback">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      <p className="text-sm text-zinc-500">{error || "Signing you in…"}</p>
    </div>
  );
}
