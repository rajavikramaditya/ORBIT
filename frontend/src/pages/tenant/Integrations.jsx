import { useEffect, useState } from "react";
import {
  Database, Phone, MessageCircle, Bot, Play, Loader2, Info, ShieldCheck, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";

const CAT_ICON = { business: Database, ai_employee: Bot };
const chanIcon = (type) => (type === "whatsapp" ? MessageCircle : Phone);

function ResultView({ res }) {
  if (!res) return null;
  if (res.status === "ok") {
    const isMock = res.mock || res.mode === "mock";
    return (
      <div className={`mt-3 rounded-xl border p-3 text-sm ${isMock ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className={`text-xs font-semibold mb-1.5 ${isMock ? "text-amber-700" : "text-emerald-700"}`}>
          {isMock ? "⚠ MOCK / demo data (not real)" : "Live data"}
        </div>
        <pre className="text-xs text-zinc-700 whitespace-pre-wrap break-words font-mono">{JSON.stringify(res.data, null, 2)}</pre>
      </div>
    );
  }
  const map = {
    unavailable: ["border-zinc-200 bg-zinc-50", "text-zinc-600"],
    disabled: ["border-zinc-200 bg-zinc-50", "text-zinc-600"],
    confirmation_required: ["border-blue-200 bg-blue-50", "text-blue-700"],
  };
  const [box, txt] = map[res.status] || map.unavailable;
  return <div className={`mt-3 rounded-xl border p-3 text-sm ${box} ${txt}`}>{res.message}</div>;
}

export default function Integrations() {
  const [systems, setSystems] = useState(null);
  const [tools, setTools] = useState(null);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);

  useEffect(() => {
    api.get("/tenant/integrations").then((r) => setSystems(r.data.systems)).catch(() => setSystems([]));
    api.get("/tenant/tools").then((r) => setTools(r.data)).catch(() => setTools([]));
  }, []);

  const hasMock = (systems || []).some((s) => s.is_mock);

  const runTool = async (tool, confirmed = false) => {
    setRunning(tool.id);
    try {
      const r = await api.post(`/tenant/tools/${tool.id}/preview`, { args: {}, confirmed });
      setResults((prev) => ({ ...prev, [tool.id]: r.data }));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-8" data-testid="tenant-integrations">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Business Integrations</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">The systems your AI employee is connected to. Setup is managed by ORBIT.</p>
      </div>

      {hasMock && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4" data-testid="mock-notice">
          <Info className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900/80 leading-relaxed">
            One or more integrations run on <span className="font-semibold">MOCK demo data</span> because a real business
            system isn't connected yet. Mock results are clearly labelled and must never be treated as real operational data.
          </p>
        </div>
      )}

      {/* Connected systems */}
      {!systems && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {systems?.map((s) => {
          const Icon = s.category === "channel" ? chanIcon(s.type) : (CAT_ICON[s.category] || Database);
          const kind = s.category === "ai_employee" ? "lifecycle" : "channel";
          return (
            <div key={s.key} className="rounded-2xl border border-black/5 bg-white p-5" data-testid="integration-system-card">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-xl bg-zinc-100 grid place-items-center text-zinc-700"><Icon className="w-5 h-5" strokeWidth={1.7} /></span>
                <StatusBadge kind={kind} value={s.status} />
              </div>
              <div className="mt-4 text-sm font-semibold">{s.label}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-zinc-400 capitalize">{s.category.replace("_", " ")}</span>
                {s.is_mock && <span className="text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">MOCK</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tools */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-zinc-500" />
          <h2 className="font-display text-lg font-semibold">What your AI employee can do</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          <span className="font-medium text-zinc-700">Read</span> tools fetch live information automatically.
          <span className="font-medium text-zinc-700"> Action</span> tools (bookings, changes) always require explicit confirmation.
        </p>

        {!tools && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
        {tools && tools.length === 0 && (
          <div className="rounded-2xl border border-black/5 bg-white p-10 text-center text-sm text-zinc-500">
            No business tools configured yet. ORBIT will connect your systems during onboarding.
          </div>
        )}

        <div className="space-y-3">
          {tools?.map((t) => (
            <div key={t.id} className="rounded-2xl border border-black/5 bg-white p-5" data-testid="tool-card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${t.kind === "action" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {t.kind === "action" ? "ACTION" : "READ"}
                    </span>
                    <span className="text-sm font-semibold">{t.name}</span>
                    {!t.enabled && <span className="text-[10px] rounded-full bg-zinc-100 text-zinc-500 px-2 py-0.5">Disabled</span>}
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{t.description}</p>
                  <div className="mt-1.5 text-xs text-zinc-400">
                    via {t.integration_name || "—"}{t.integration_mode === "mock" ? " · MOCK" : ""}
                  </div>
                  <ResultView res={results[t.id]} />
                </div>
                <div className="shrink-0">
                  {t.kind === "read" ? (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={running === t.id}
                      onClick={() => runTool(t, false)} data-testid={`tool-run-${t.key}`}>
                      {running === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3.5 h-3.5 mr-1.5" /> Test</>}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-full" disabled={!t.enabled || running === t.id}
                      onClick={() => runTool(t, true)} data-testid={`tool-run-${t.key}`}>
                      {running === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Run (confirm)</>}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
