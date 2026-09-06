import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, MessagesSquare, Clock, Bot, Wand2, Loader2, Radio, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader, StatTile, Card, CardHeader, SectionTitle, EmptyState } from "@/components/AppUI";

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
      <PageHeader eyebrow={'Your workspace'} title={'Overview'} subtitle={'A live view of your AI employee.'} actions={
        <>{canSimulate && (
          <Button onClick={simulate} disabled={simulating} data-testid="simulate-call-btn"
            className="rounded-full h-11 px-5 bg-orbit-text hover:bg-orbit-text/90">
            {simulating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PhoneCall className="w-4 h-4 mr-2" />}
            Simulate inbound call
          </Button>
        )}</>
      } />


      {error && <LoadError error={error} onRetry={load} />}

      {ready && (
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-6 space-y-6" data-testid="readiness-bar">
          {/* Header & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-semibold text-orbit-text">
                {ready.is_live ? "Your AI Employee is Live" : `Onboarding: ${ready.stage_label || "Setup in progress"}`}
              </div>
              <div className="text-xs text-orbit-text/55 mt-0.5">
                Data Source: <span className="font-medium text-orbit-text/75">{ready.data_source_label}</span>
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
                        ? "border-orbit-text/10 bg-orbit-sand p-4"
                        : "border-black/5 bg-white px-4 py-3"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${
                          isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : isActive
                            ? "bg-orbit-text text-white"
                            : "bg-orbit-text/[0.06] text-orbit-text/40"
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5" /> : step.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm ${isActive ? "font-semibold text-orbit-text" : "font-medium text-orbit-text/75"}`}>
                          {step.label}
                        </div>
                        {(isActive || isDone) && (
                          <p className="mt-0.5 text-xs text-orbit-text/55 leading-relaxed">{step.detail}</p>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${
                          isDone
                            ? "bg-emerald-50 text-emerald-700"
                            : isActive
                            ? "bg-amber-50 text-amber-800"
                            : "bg-orbit-sand text-orbit-text/40"
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
                          className="rounded-full h-9 px-4 bg-orbit-text hover:bg-orbit-text/90"
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


      {/* Conversations is emphasised on purpose: it is the number that answers
          "is this thing earning its keep?", and five identical grey tiles gave
          an owner no way to tell which figure mattered. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile icon={MessagesSquare} label="Conversations" value={s?.conversations ?? "—"}
          hint="Handled end to end" emphasis testid="stat-conversations" />
        <StatTile icon={Clock} label="Call minutes" value={s?.total_call_minutes ?? "—"} testid="stat-minutes" />
        <StatTile icon={Bot} label="AI employees" value={s?.ai_employees ?? "—"} testid="stat-ai" />
        <StatTile icon={Radio} label="Channels" value={s?.channels ?? "—"} testid="stat-channels" />
        <StatTile icon={Wand2} label="Open requests" value={s?.open_requests ?? "—"} testid="stat-requests" />
      </div>

      <Card flush>
        <CardHeader>
          <SectionTitle hint="The last six calls your AI employee handled.">
            Recent conversations
          </SectionTitle>
        </CardHeader>
        <div className="divide-y divide-black/5">
          {loading && <Loading />}
          {!loading && !error && data && (data.recent_conversations || []).length === 0 && (
            <EmptyState icon={PhoneCall} title="No conversations yet">
              {canSimulate
                ? "Simulate an inbound call to see what your AI employee does with it."
                : "As soon as someone calls, the transcript and summary land here."}
            </EmptyState>
          )}
          {(data?.recent_conversations || []).map((c) => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between" data-testid="recent-conversation-row">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center"><PhoneCall className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{c.summary_title}</div>
                  <div className="text-xs text-orbit-text/40">{c.direction} · {c.external_number || "—"}</div>
                </div>
              </div>
              <div className="text-xs text-orbit-text/55 shrink-0">{Math.floor((c.duration_secs || 0) / 60)}m {(c.duration_secs || 0) % 60}s</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
