import { useEffect, useState } from "react";
import { Bot, Mic, Info, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

export default function AIEmployees() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/tenant/ai-employees").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  return (
    <div className="space-y-8" data-testid="tenant-ai-employees">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">AI Employees</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">Your dedicated AI staff, configured and managed by ORBIT.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4">
        <Info className="w-4.5 h-4.5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-900/80 leading-relaxed">
          Prompts, personality, knowledge base and voice behaviour are managed by ORBIT. To change how an AI
          employee behaves, submit a <span className="font-medium">Customization request</span>.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-sm font-semibold">Static knowledge</div>
          <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">Business info, policies, services, hours and FAQs — curated by ORBIT and used for general answers.</p>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-sm font-semibold">Live business data</div>
          <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">Availability, bookings and orders pulled live from your connected systems — configured under Integrations.</p>
        </div>
      </div>

      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-black/5 bg-white p-10 text-center text-sm text-zinc-500">
          No AI employees yet. Our team will provision one during onboarding.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {items?.map((ae) => (
          <div key={ae.id} className="rounded-2xl border border-black/5 bg-white p-6" data-testid="ai-employee-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-zinc-900 text-white grid place-items-center font-display font-semibold text-lg">
                  {ae.name.charAt(0)}
                </span>
                <div>
                  <div className="font-display text-lg font-semibold">{ae.name}</div>
                  <div className="text-sm text-zinc-500">{ae.role_title}</div>
                </div>
              </div>
              <StatusBadge kind="lifecycle" value={ae.lifecycle_state} testid="ai-lifecycle-badge" />
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm text-zinc-600">
              <Mic className="w-4 h-4 text-zinc-400" /> {ae.voice_name} — {ae.voice_description}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
              <Bot className="w-3.5 h-3.5" /> Managed by ORBIT · Voice AI configured
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
