import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, MessagesSquare, Clock, Bot, Wand2, Loader2, Radio, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";

const StatCard = ({ icon: Icon, label, value, testid }) => (
  <div className="rounded-2xl border border-black/5 bg-white p-5" data-testid={testid}>
    <span className="w-9 h-9 rounded-xl bg-zinc-100 grid place-items-center text-zinc-700"><Icon className="w-4.5 h-4.5" strokeWidth={1.7} /></span>
    <div className="mt-4 font-display text-3xl font-semibold">{value}</div>
    <div className="mt-1 text-sm text-zinc-500">{label}</div>
  </div>
);

export default function Overview() {
  const navigate = useNavigate();
  const { data, error, loading, reload: load } = useApiResource("/tenant/overview");
  const { data: ready } = useApiResource("/tenant/readiness");
  const [simulating, setSimulating] = useState(false);

  // Only offer the simulate button once we actually know the environment.
  // Before, a failed readiness call left `ready` null and `ready?.environment
  // !== "production"` still evaluated true — so the button appeared on live
  // accounts and failed when pressed.
  const canSimulate = !!ready && ready.environment !== "production";

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

  const runStepAction = (step) => {
    const action = step.action;
    if (!action) return;
    if (action.type === "navigate") navigate(action.route);
    else if (action.type === "simulate_call") simulate();
    else if (action.type === "ask_orbit")
      navigate(`/dashboard/customization?ask=${encodeURIComponent(step.key)}&label=${encodeURIComponent(step.label)}`);
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

      {error && <LoadError error={error} onRetry={load} />}

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

          {/* Guided onboarding wizard — one row per step, driven entirely by the backend
              (backend/routes_tenant.py's readiness() builds `wizard_steps`, so the frontend
              never guesses stage order or ownership). Active step always shows a real button. */}
          {ready.wizard_steps?.length > 0 && (
            <div className="space-y-2" data-testid="onboarding-wizard">
              {ready.wizard_steps.map((step) => {
                const isDone = step.status === "done";
                const isActive = step.status === "active";
                return (
                  <div
                    key={step.key}
                    data-testid={`wizard-step-${step.key}`}
                    className={`rounded-xl border transition-all ${
                      isActive
                        ? "border-zinc-900/10 bg-zinc-50 p-4"
                        : "border-black/5 bg-white px-4 py-3"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${
                          isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : isActive
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-400"
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : step.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${isActive ? "font-semibold text-zinc-900" : "font-medium text-zinc-700"}`}>
                          {step.label}
                        </div>
                        {(isActive || isDone) && (
                          <p className="mt-0.5 text-xs text-zinc-500 leading-relaxed">{step.detail}</p>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700"
                            : isActive
                            ? "bg-amber-50 text-amber-800"
                            : "bg-zinc-50 text-zinc-400"
                        }`}
                      >
                        {isDone ? "Completed" : isActive ? "In progress" : "Upcoming"}
                      </span>
                    </div>
                    {isActive && step.action && (
                      <div className="mt-3 pl-9">
                        <Button
                          size="sm"
                          onClick={() => runStepAction(step)}
                          disabled={step.action.type === "simulate_call" && simulating}
                          data-testid={`wizard-action-${step.key}`}
                          className="rounded-full h-9 px-4 bg-zinc-900 hover:bg-zinc-800"
                        >
                          {step.action.type === "simulate_call" && simulating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5 mr-2" />
                          )}
                          {step.action.label}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
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
          {loading && <Loading />}
          {!loading && !error && data && (data.recent_conversations || []).length === 0 && (
            <div className="p-10 text-center text-sm text-zinc-500">
              {canSimulate ? "No conversations yet — try simulating a call." : "No conversations yet."}
            </div>
          )}
          {(data?.recent_conversations || []).map((c) => (
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
