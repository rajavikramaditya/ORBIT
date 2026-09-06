import { useState } from "react";
import { Loader2, IndianRupee, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader } from "@/components/AppUI";

const INV_STATUS = {
  draft: ["Draft", "bg-orbit-text/[0.06] text-orbit-text/65"],
  issued: ["Issued", "bg-orbit-text/[0.06] text-orbit-text/70"],
  due: ["Due", "bg-amber-50 text-amber-700"],
  paid: ["Paid", "bg-emerald-50 text-emerald-700"],
  failed: ["Failed", "bg-red-50 text-red-700"],
  demo: ["Demo — not charged", "bg-orbit-text/[0.06] text-orbit-text/55"],
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

  if (loading && !data) return <Loading />;
  if (error && !data) return <LoadError error={error} onRetry={load} />;
  if (!data) return null;
  const u = data.current_usage || {};
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];

  return (
    <div className="space-y-8" data-testid="tenant-billing">
      <PageHeader eyebrow={'Billing'} title={'Billing & Usage'} subtitle={'Usage-based, billed monthly in INR (incl. GST).'} />

      {data.spend_status === "warning" && (
        <div className="flex items-center gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4" data-testid="spend-warning">
          <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          <p className="text-sm text-amber-900/80">You're approaching your monthly usage threshold.</p>
        </div>
      )}
      {data.spend_status === "capped" && (
        <div className="flex items-center gap-3 rounded-[22px] border border-red-200 bg-red-50 px-5 py-4" data-testid="spend-capped">
          <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
          <p className="text-sm text-red-900/80">Monthly hard cap reached. Contact ORBIT to raise your limit.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5">
          <div className="text-xs text-orbit-text/40">This month (est.)</div>
          <div className="mt-2 font-display text-2xl font-semibold flex items-center"><IndianRupee className="w-5 h-5" />{Number(data.estimated_total || 0).toLocaleString("en-IN")}</div>
          {data.environment === "demo" && <div className="mt-1 text-[10px] font-semibold text-orbit-text/40">DEMO — not charged</div>}
        </div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5"><div className="text-xs text-orbit-text/40">AI voice</div><div className="mt-2 font-display text-2xl font-semibold">{u.ai_minutes ?? 0}<span className="text-sm text-orbit-text/40"> min</span></div></div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5"><div className="text-xs text-orbit-text/40">Telephony</div><div className="mt-2 font-display text-2xl font-semibold">{u.telephony_minutes ?? 0}<span className="text-sm text-orbit-text/40"> min</span></div></div>
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5"><div className="text-xs text-orbit-text/40">WhatsApp</div><div className="mt-2 font-display text-2xl font-semibold">{u.whatsapp_messages ?? 0}<span className="text-sm text-orbit-text/40"> msg</span></div></div>
      </div>

      <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)]">
        <div className="px-6 py-4 border-b border-black/5"><h2 className="font-display text-lg font-semibold">Invoices</h2></div>
        {invoices.length === 0 && <div className="p-10 text-center text-sm text-orbit-text/55">No invoices yet.</div>}
        <div className="divide-y divide-black/5">
          {invoices.map((inv) => {
            const [label, cls] = INV_STATUS[inv.status] || [inv.status, "bg-orbit-text/[0.06] text-orbit-text/65"];
            const payable = inv.status === "due" || inv.status === "payment_config_required" || inv.status === "failed";
            return (
              <div key={inv.id} className="px-6 py-4 flex items-center justify-between gap-4" data-testid="invoice-row">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{inv.period}</div>
                  <div className="text-xs text-orbit-text/40">{money(inv.total)} · incl. GST {inv.tax_pct}%</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${cls}`}>{label}</span>
                  {inv.status === "paid" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {payable && (
                    <Button size="sm" className="rounded-full h-8 bg-orbit-text hover:bg-orbit-text/90" disabled={paying === inv.id}
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
