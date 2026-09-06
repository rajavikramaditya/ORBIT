import { useState } from "react";
import { Loader2, IndianRupee, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";

const INV_STATUS = {
  draft: ["Draft", "bg-zinc-100 text-zinc-600"],
  issued: ["Issued", "bg-blue-50 text-blue-700"],
  due: ["Due", "bg-amber-50 text-amber-700"],
  paid: ["Paid", "bg-emerald-50 text-emerald-700"],
  failed: ["Failed", "bg-red-50 text-red-700"],
  demo: ["Demo — not charged", "bg-zinc-100 text-zinc-500"],
  payment_config_required: ["Payment setup pending", "bg-amber-50 text-amber-700"],
};

const money = (n, c = "INR") => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function Billing() {
  const { data, error, loading, reload: load } = useApiResource("/tenant/billing");
  const [paying, setPaying] = useState(null);

  const pay = async (inv) => {
    setPaying(inv.id);
    try {
      const r = await api.post(`/tenant/invoices/${inv.id}/pay`);
      if (r.data.status === "payment_config_required") toast.warning("Production payment configuration required.");
      else if (r.data.status === "order_created") toast.success("Payment order created. Opening checkout…");
      await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setPaying(null); }
  };

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} onRetry={load} />;
  if (!data) return null;
  const u = data.current_usage || {};
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];

  return (
    <div className="space-y-8" data-testid="tenant-billing">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Billing & Usage</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">Usage-based, billed monthly in INR (incl. GST).</p>
      </div>

      {data.spend_status === "warning" && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4" data-testid="spend-warning">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          <p className="text-sm text-amber-900/80">You're approaching your monthly usage threshold.</p>
        </div>
      )}
      {data.spend_status === "capped" && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4" data-testid="spend-capped">
          <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
          <p className="text-sm text-red-900/80">Monthly hard cap reached. Contact ORBIT to raise your limit.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-black/5 bg-white p-5">
          <div className="text-xs text-zinc-400">This month (est.)</div>
          <div className="mt-2 font-display text-2xl font-semibold flex items-center"><IndianRupee className="w-5 h-5" />{Number(data.estimated_total || 0).toLocaleString("en-IN")}</div>
          {data.environment === "demo" && <div className="mt-1 text-[10px] font-semibold text-zinc-400">DEMO — not charged</div>}
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-5"><div className="text-xs text-zinc-400">AI voice</div><div className="mt-2 font-display text-2xl font-semibold">{u.ai_minutes ?? 0}<span className="text-sm text-zinc-400"> min</span></div></div>
        <div className="rounded-2xl border border-black/5 bg-white p-5"><div className="text-xs text-zinc-400">Telephony</div><div className="mt-2 font-display text-2xl font-semibold">{u.telephony_minutes ?? 0}<span className="text-sm text-zinc-400"> min</span></div></div>
        <div className="rounded-2xl border border-black/5 bg-white p-5"><div className="text-xs text-zinc-400">WhatsApp</div><div className="mt-2 font-display text-2xl font-semibold">{u.whatsapp_messages ?? 0}<span className="text-sm text-zinc-400"> msg</span></div></div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white">
        <div className="px-6 py-4 border-b border-black/5"><h2 className="font-display text-lg font-semibold">Invoices</h2></div>
        {invoices.length === 0 && <div className="p-10 text-center text-sm text-zinc-500">No invoices yet.</div>}
        <div className="divide-y divide-black/5">
          {invoices.map((inv) => {
            const [label, cls] = INV_STATUS[inv.status] || [inv.status, "bg-zinc-100 text-zinc-600"];
            const payable = inv.status === "due" || inv.status === "payment_config_required" || inv.status === "failed";
            return (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between gap-4" data-testid="invoice-row">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{inv.period}</div>
                  <div className="text-xs text-zinc-400">{money(inv.total)} · incl. GST {inv.tax_pct}%</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${cls}`}>{label}</span>
                  {inv.status === "paid" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {payable && (
                    <Button size="sm" className="rounded-full h-8 bg-zinc-900 hover:bg-zinc-800" disabled={paying === inv.id}
                      onClick={() => pay(inv)} data-testid="pay-invoice-btn">
                      {paying === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Pay"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
