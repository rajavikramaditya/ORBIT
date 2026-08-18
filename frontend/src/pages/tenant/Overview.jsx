import { useEffect, useState } from "react";
import { PhoneCall, MessagesSquare, Clock, Bot, Wand2, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";

const StatCard = ({ icon: Icon, label, value, testid }) => (
  <div className="rounded-2xl border border-black/5 bg-white p-5" data-testid={testid}>
    <span className="w-9 h-9 rounded-xl bg-zinc-100 grid place-items-center text-zinc-700"><Icon className="w-4.5 h-4.5" strokeWidth={1.7} /></span>
    <div className="mt-4 font-display text-3xl font-semibold">{value}</div>
    <div className="mt-1 text-sm text-zinc-500">{label}</div>
  </div>
);

export default function Overview() {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(null);
  const [simulating, setSimulating] = useState(false);

  const load = async () => {
    try {
      const res = await api.get("/tenant/overview");
      setData(res.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  useEffect(() => {
    load();
    api.get("/tenant/readiness").then((r) => setReady(r.data)).catch(() => {});
  }, []);

  const simulate = async () => {
    setSimulating(true);
    try {
      const res = await api.post("/tenant/simulate-call", { direction: "inbound" });
      toast.success(`Call captured: ${res.data.summary_title}`);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSimulating(false);
    }
  };

  const s = data?.stats;

  return (
    <div className="space-y-8" data-testid="tenant-overview">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1.5 text-zinc-500 text-sm">A live view of your AI employee.</p>
        </div>
        <Button onClick={simulate} disabled={simulating} data-testid="simulate-call-btn"
          className="rounded-full h-11 px-5 bg-zinc-900 hover:bg-zinc-800">
          {simulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PhoneCall className="w-4 h-4 mr-2" />}
          Simulate inbound call
        </Button>
      </div>

      {ready && (
        <div className="rounded-2xl border border-black/5 bg-white p-5" data-testid="readiness-bar">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">{ready.is_live ? "Your AI employee is live" : "Setup in progress"}</div>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${ready.is_live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {ready.is_live ? "Live" : "Action needed"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(ready.items).map(([k, v]) => {
              const good = ["live", "connected"].includes(v.status);
              const warn = v.status === "action_required";
              return (
                <div key={k} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full ${good ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-zinc-300"}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{v.label}</div>
                    <div className="text-[11px] text-zinc-400 capitalize">{v.status.replace("_", " ")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={MessagesSquare} label="Conversations" value={s?.conversations ?? "—"} testid="stat-conversations" />
        <StatCard icon={Clock} label="Call minutes" value={s?.total_call_minutes ?? "—"} testid="stat-minutes" />
        <StatCard icon={Bot} label="AI employees" value={s?.ai_employees ?? "—"} testid="stat-ai" />
        <StatCard icon={Radio} label="Channels" value={s?.channels ?? "—"} testid="stat-channels" />
        <StatCard icon={Wand2} label="Open requests" value={s?.open_requests ?? "—"} testid="stat-requests" />
      </div>

      <div className="rounded-2xl border border-black/5 bg-white">
        <div className="px-6 py-4 border-b border-black/5">
          <h2 className="font-display text-lg font-semibold">Recent conversations</h2>
        </div>
        <div className="divide-y divide-black/5">
          {!data && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
          {data && data.recent_conversations.length === 0 && (
            <div className="p-10 text-center text-sm text-zinc-500">No conversations yet — try simulating a call.</div>
          )}
          {data?.recent_conversations.map((c) => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between" data-testid="recent-conversation-row">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><PhoneCall className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.summary_title}</div>
                  <div className="text-xs text-zinc-400">{c.direction} · {c.external_number || "—"}</div>
                </div>
              </div>
              <div className="text-xs text-zinc-500 shrink-0">{Math.floor((c.duration_secs || 0) / 60)}m {(c.duration_secs || 0) % 60}s</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
