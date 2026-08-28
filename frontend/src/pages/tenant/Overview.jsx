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
  const canSimulate = ready?.environment !== "production";

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
        {canSimulate && (
          <Button onClick={simulate} disabled={simulating} data-testid="simulate-call-btn"
            className="rounded-full h-11 px-5 bg-zinc-900 hover:bg-zinc-800">
            {simulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PhoneCall className="w-4 h-4 mr-2" />}
            Simulate inbound call
          </Button>
        )}
      </div>

      {ready && (
        <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-6" data-testid="readiness-bar">
          {/* Header & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-zinc-900">
                {ready.is_live ? "Your AI Employee is Live" : `Onboarding: ${ready.stage_label || "Setup in progress"}`}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Data Source: <span className="font-medium text-zinc-700">{ready.data_source_label}</span>
              </div>
            </div>
            <span className={`text-xs font-semibold rounded-full px-3 py-1 ${
              ready.is_live
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}>
              {ready.is_live ? "Live in Production" : "Setup in Progress"}
            </span>
          </div>

          {/* Customer Onboarding Journey Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { key: "business_details", label: "1. Business Setup" },
              { key: "ai_employee_setup", label: "2. AI Employee" },
              { key: "business_data", label: "3. Information" },
              { key: "channel_setup", label: "4. Channels" },
              { key: "testing", label: "5. Testing" },
              { key: "ready_for_approval", label: "6. Approval" },
              { key: "live", label: "7. Go Live" },
            ].map((step, idx) => {
              const stagesOrder = ["created", "business_details", "ai_employee_setup", "business_data", "channel_setup", "testing", "ready_for_approval", "live"];
              const currentIdx = stagesOrder.indexOf(ready.onboarding_stage || "business_details");
              const stepIdx = stagesOrder.indexOf(step.key);
              const isPast = currentIdx > stepIdx || ready.is_live;
              const isCurrent = currentIdx === stepIdx && !ready.is_live;

              return (
                <div
                  key={step.key}
                  className={`rounded-xl p-2.5 text-center border transition-all ${
                    isPast
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                      : isCurrent
                      ? "bg-zinc-900 border-zinc-900 text-white font-medium shadow-sm"
                      : "bg-zinc-50 border-zinc-100 text-zinc-400"
                  }`}
                >
                  <div className="text-[11px] truncate">{step.label}</div>
                  <div className={`text-[10px] mt-0.5 ${isCurrent ? "text-zinc-300" : isPast ? "text-emerald-600" : "text-zinc-400"}`}>
                    {isPast ? "Completed" : isCurrent ? "Active" : "Upcoming"}
                  </div>
                </div>
              );
            })}
          </div>

          {ready.progress?.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2" data-testid="readiness-progress">
              {ready.progress.map((row) => (
                <div key={row.label} className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-700">{row.label}</span>
                  <span className={`text-[11px] font-semibold ${row.status === "ready" ? "text-emerald-700" : "text-amber-800"}`}>
                    {row.status === "ready" ? "✓ Ready" : row.detail}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* What We Need From You / What ORBIT Is Handling */}
          {(ready.needs_from_you?.length > 0 || ready.waiting_for_orbit?.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-black/5">
              {ready.needs_from_you?.length > 0 && (
                <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-2" data-testid="needs-from-you">
                  <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Action Required From You
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-800">
                    {ready.needs_from_you.map((n) => (
                      <li key={n.label} className="leading-relaxed">
                        <strong className="font-medium">{n.label}:</strong> {n.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ready.waiting_for_orbit?.length > 0 && (
                <div className="rounded-xl bg-zinc-50 border border-black/5 p-4 space-y-2" data-testid="waiting-for-orbit">
                  <div className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-zinc-400" />
                    ORBIT Is Currently Handling
                  </div>
                  <ul className="space-y-1.5 text-xs text-zinc-600">
                    {ready.waiting_for_orbit.map((n) => (
                      <li key={n.label} className="leading-relaxed">
                        <strong className="font-medium text-zinc-700">{n.label}:</strong> {n.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
            <div className="p-10 text-center text-sm text-zinc-500">
              {canSimulate ? "No conversations yet — try simulating a call." : "No conversations yet."}
            </div>
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
