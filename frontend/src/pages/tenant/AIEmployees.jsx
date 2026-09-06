import { Bot, Mic, Info } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader, InfoNote } from "@/components/AppUI";

export default function AIEmployees() {
  const { data: items, error, loading, reload } = useApiResource("/tenant/ai-employees");

  return (
    <div className="space-y-8" data-testid="tenant-ai-employees">
      <PageHeader eyebrow={'Your team'} title={'AI Employees'} subtitle={'Your dedicated AI staff, configured and managed by ORBIT.'} />

      <InfoNote icon={Info} tone="gold">
          Prompts, personality, knowledge base and voice behaviour are managed by ORBIT. To change how an AI
          employee behaves, submit a <span className="font-medium">Customization request</span>.
        </InfoNote>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5">
          <div className="text-sm font-semibold">Static knowledge</div>
          <p className="mt-1.5 text-sm text-orbit-text/55 leading-relaxed">Business info, policies, services, hours and FAQs — curated by ORBIT and used for general answers.</p>
        </div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5">
          <div className="text-sm font-semibold">Live business data</div>
          <p className="mt-1.5 text-sm text-orbit-text/55 leading-relaxed">Availability, bookings and orders pulled live from your connected systems — configured under Integrations.</p>
        </div>
      </div>

      {loading && <Loading />}
      {error && <LoadError error={error} onRetry={reload} />}
      {!loading && !error && items?.length === 0 && (
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-10 text-center text-sm text-orbit-text/55">
          No AI employees yet. Our team will provision one during onboarding.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {items?.map((ae) => (
          <div key={ae.id} className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-6" data-testid="ai-employee-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-[22px] bg-orbit-text text-white grid place-items-center font-display font-semibold text-lg">
                  {(ae.name || "?").charAt(0)}
                </span>
                <div>
                  <div className="font-display text-lg font-semibold">{ae.name}</div>
                  <div className="text-sm text-orbit-text/55">{ae.role_title}</div>
                </div>
              </div>
              <StatusBadge kind="lifecycle" value={ae.lifecycle_state} testid="ai-lifecycle-badge" />
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm text-orbit-text/65">
              <Mic className="w-4 h-4 text-orbit-text/40" /> {ae.voice_name} — {ae.voice_description}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-orbit-text/40">
              <Bot className="w-3.5 h-3.5" /> Managed by ORBIT · Voice AI configured
            </div>
            {ae.knowledge_base?.business_info && (
              <div className="mt-4 rounded-xl bg-orbit-sand border border-black/5 p-3" data-testid="ai-knowledge">
                <div className="text-xs font-semibold text-orbit-text/55 mb-1">Knowledge base (static)</div>
                <p className="text-xs text-orbit-text/55 leading-relaxed">{ae.knowledge_base.business_info}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
