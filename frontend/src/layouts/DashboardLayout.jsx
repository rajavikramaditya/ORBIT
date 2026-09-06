import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Bot, Radio, MessagesSquare, Wand2, Settings as SettingsIcon,
  LogOut, ChevronDown, PlugZap, Receipt, Zap, Inbox, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { OrbitLogo } from "@/components/OrbitLogo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", end: true, icon: LayoutGrid, label: "Overview", testid: "nav-overview" },
  { to: "/dashboard/ai-employees", icon: Bot, label: "AI Employees", testid: "nav-ai-employees" },
  { to: "/dashboard/channels", icon: Radio, label: "Channels", testid: "nav-channels" },
  { to: "/dashboard/integrations", icon: PlugZap, label: "Integrations", testid: "nav-integrations" },
  { to: "/dashboard/live-data", icon: Zap, label: "Live Data", testid: "nav-live-data" },
  { to: "/dashboard/conversations", icon: MessagesSquare, label: "Conversations", testid: "nav-conversations" },
  { to: "/dashboard/leads", icon: Inbox, label: "Leads", testid: "nav-leads" },
  { to: "/dashboard/customization", icon: Wand2, label: "Customization", testid: "nav-customization" },
  { to: "/dashboard/billing", icon: Receipt, label: "Billing", testid: "nav-billing" },
  { to: "/dashboard/settings", icon: SettingsIcon, label: "Settings", testid: "nav-settings" },
];

const ONBOARDING_SENT_KEY = "orbit_onboarding_redirected";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tenant = user?.tenant;
  const brand = tenant?.branding?.brand_color || "#18181B";

  // A brand-new (or still-incomplete) owner sees the full-screen onboarding
  // flow instead of the dashboard shell — OnboardingWelcome.jsx sends them back
  // here once their business profile is filled in, at which point this check
  // naturally passes and the sidebar renders as normal. Platform admins never
  // reach this layout, so no check needed for that role here.
  // The redirect fires at most ONCE per browser session (see ONBOARDING_SENT_KEY
  // above). Without that guard, a tenant whose profile the backend still reads as
  // incomplete bounced forever: /dashboard sent them to /onboarding, "Go to
  // dashboard" sent them back, and the screen flickered between the two.
  const [gateChecked, setGateChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  useEffect(() => {
    let alreadySent = false;
    try {
      alreadySent = sessionStorage.getItem(ONBOARDING_SENT_KEY) === "1";
    } catch {
      /* private mode — just don't redirect twice-proof, never block the user */
    }
    if (alreadySent) {
      setGateChecked(true);
      return;
    }
    api.get("/tenant/readiness")
      .then((r) => {
        const needs = r.data?.onboarding_stage === "business_details";
        if (needs) {
          try {
            sessionStorage.setItem(ONBOARDING_SENT_KEY, "1");
          } catch {
            /* ignore */
          }
        }
        setNeedsOnboarding(needs);
      })
      // Fail OPEN on a transient error (network blip, brief auth hiccup) — never
      // trap a real user behind a broken gate just because one fetch failed.
      .catch(() => setNeedsOnboarding(false))
      .finally(() => setGateChecked(true));
  }, []);

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (!gateChecked) {
    return (
      <div className="min-h-screen grid place-items-center bg-white" data-testid="dashboard-gate-loading">
        <Loader2 className="w-6 h-6 animate-spin text-orbit-text/40" />
      </div>
    );
  }
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return (
    <div className="min-h-screen bg-orbit-sand flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-black/5 bg-white hidden md:flex flex-col fixed inset-y-0">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-black/5">
          <OrbitLogo className="h-[26px] w-[26px] text-orbit-text" title="ORBIT" />
          <span className="font-display text-[19px] font-bold tracking-[-0.04em]">ORBIT</span>
        </div>
        <div className="border-b border-black/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] font-display text-[15px] font-bold text-white"
              style={{ backgroundColor: brand }}
            >
              {(tenant?.name || "B").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div
                className="truncate font-display text-[15px] font-semibold capitalize tracking-[-0.01em]"
                data-testid="sidebar-tenant-name"
              >
                {tenant?.name || "Your Business"}
              </div>
              <div className="mt-1"><StatusBadge kind="tenant" value={tenant?.status || "onboarding"} /></div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px] transition-colors ${
                  isActive
                    ? "bg-orbit-sand font-medium text-orbit-text"
                    : "text-orbit-text/60 hover:bg-orbit-sand/70 hover:text-orbit-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* A gold rail marks the current page instead of inverting the
                      whole row — the accent from the landing, used once. */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-orbit-gold transition-opacity ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <n.icon className="h-[17px] w-[17px]" strokeWidth={isActive ? 2 : 1.7} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-black/5 px-4 py-4">
          <div className="flex items-center gap-2 text-[12px] text-orbit-text/40">
            <span className="h-1.5 w-1.5 rounded-full bg-orbit-live" />
            Managed by ORBIT
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/5 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
          <div className="md:hidden flex items-center gap-2">
            <OrbitLogo className="h-[22px] w-[22px] text-orbit-text" title="ORBIT" />
            <span className="font-display font-semibold text-sm">{tenant?.name}</span>
          </div>
          <div className="hidden text-[14px] text-orbit-text/45 md:block">
            Welcome back, <span className="font-medium text-orbit-text/80">{user?.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-orbit-text/[0.06] transition-colors" data-testid="user-menu">
                <span className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ backgroundColor: brand }}>
                  {(user?.name || "U").charAt(0)}
                </span>
                <span className="text-sm text-orbit-text/75 hidden sm:block">{user?.name}</span>
                <ChevronDown className="w-4 h-4 text-orbit-text/40" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-orbit-text/40 truncate">{user?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={doLogout} data-testid="logout-btn" className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="mx-auto w-full max-w-6xl p-6 lg:p-10">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
