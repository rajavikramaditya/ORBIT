import { useEffect, useState } from "react";
import { Phone, MessageCircle, AlertTriangle, Loader2, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

export default function Channels() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/tenant/channels").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  const phone = items?.filter((c) => c.type === "phone") || [];
  const whatsapp = items?.filter((c) => c.type === "whatsapp") || [];
  const form = items?.filter((c) => c.type === "form") || [];

  const ChannelCard = ({ c, icon: Icon, color }) => (
    <div className="rounded-2xl border border-black/5 bg-white p-6" data-testid={`channel-${c.type}`}>
      <div className="flex items-start justify-between">
        <span className={`w-11 h-11 rounded-2xl grid place-items-center text-white ${color}`}><Icon className="w-5 h-5" /></span>
        <StatusBadge kind="channel" value={c.status} testid={`channel-status-${c.type}`} />
      </div>
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">{c.type === "phone" ? "Connected number" : c.type === "form" ? "Intake" : "Account"}</span>
          <span className="font-medium">{c.intake_path || c.connected_identifier || "—"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Assigned AI employee</span>
          <span className="font-medium">{c.assigned_ai_employee_name || "Unassigned"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Managed by</span>
          <span className="font-medium">ORBIT</span>
        </div>
      </div>
      {c.status === "action_required" || c.status === "setup_in_progress" ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="action-required-banner">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {c.meta?.note || "ORBIT setup team is completing this connection — no action needed from you."}
          </p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-8" data-testid="tenant-channels">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Channels</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">How customers reach your AI employee. Connections are managed by ORBIT.</p>
      </div>

      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}

      {items && (
        <div className="grid md:grid-cols-2 gap-4">
          {phone.length === 0 && whatsapp.length === 0 && form.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-black/5 bg-white p-10 text-center text-sm text-zinc-500">
              No channels yet. ORBIT configures your phone and WhatsApp during onboarding.
            </div>
          )}
          {phone.map((c) => <ChannelCard key={c.id} c={c} icon={Phone} color="bg-zinc-900" />)}
          {whatsapp.map((c) => <ChannelCard key={c.id} c={c} icon={MessageCircle} color="bg-green-600" />)}
          {form.map((c) => <ChannelCard key={c.id} c={c} icon={Globe} color="bg-zinc-700" />)}
        </div>
      )}
    </div>
  );
}
