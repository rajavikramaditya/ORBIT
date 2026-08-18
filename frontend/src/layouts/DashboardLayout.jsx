import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Orbit, LayoutGrid, Bot, Radio, MessagesSquare, Wand2, Settings as SettingsIcon,
  LogOut, ChevronDown, PlugZap, Receipt,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", end: true, icon: LayoutGrid, label: "Overview", testid: "nav-overview" },
  { to: "/dashboard/ai-employees", icon: Bot, label: "AI Employees", testid: "nav-ai-employees" },
  { to: "/dashboard/channels", icon: Radio, label: "Channels", testid: "nav-channels" },
  { to: "/dashboard/integrations", icon: PlugZap, label: "Integrations", testid: "nav-integrations" },
  { to: "/dashboard/conversations", icon: MessagesSquare, label: "Conversations", testid: "nav-conversations" },
  { to: "/dashboard/customization", icon: Wand2, label: "Customization", testid: "nav-customization" },
  { to: "/dashboard/billing", icon: Receipt, label: "Billing", testid: "nav-billing" },
  { to: "/dashboard/settings", icon: SettingsIcon, label: "Settings", testid: "nav-settings" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const tenant = user?.tenant;
  const brand = tenant?.branding?.brand_color || "#18181B";

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-black/5 bg-white hidden md:flex flex-col fixed inset-y-0">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-black/5">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white grid place-items-center"><Orbit className="w-4.5 h-4.5" strokeWidth={1.6} /></div>
          <span className="font-display font-semibold">ORBIT</span>
        </div>
        <div className="px-4 py-4 border-b border-black/5">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-semibold" style={{ backgroundColor: brand }}>
              {(tenant?.name || "H").charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate" data-testid="sidebar-tenant-name">{tenant?.name || "Your Hotel"}</div>
              <div className="mt-0.5"><StatusBadge kind="tenant" value={tenant?.status || "onboarding"} /></div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={n.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`
              }
            >
              <n.icon className="w-4 h-4" strokeWidth={1.7} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-black/5 text-xs text-zinc-400">Managed by ORBIT</div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:pl-64">
        <header className="h-16 sticky top-0 z-30 glass border-b border-black/5 flex items-center justify-between px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white grid place-items-center"><Orbit className="w-4 h-4" /></div>
            <span className="font-display font-semibold text-sm">{tenant?.name}</span>
          </div>
          <div className="hidden md:block text-sm text-zinc-400">Welcome back, <span className="text-zinc-700 font-medium">{user?.name}</span></div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-zinc-100 transition-colors" data-testid="user-menu">
                <span className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-semibold" style={{ backgroundColor: brand }}>
                  {(user?.name || "U").charAt(0)}
                </span>
                <span className="text-sm text-zinc-700 hidden sm:block">{user?.name}</span>
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-zinc-400 truncate">{user?.email}</div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={doLogout} data-testid="logout-btn" className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="p-6 lg:p-8 max-w-6xl">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
