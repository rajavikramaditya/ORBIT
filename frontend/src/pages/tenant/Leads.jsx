import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader } from "@/components/AppUI";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

const STATUS_CLS = {
  new: "bg-orbit-text/[0.06] text-orbit-text/65",
  contacted: "bg-orbit-text/[0.06] text-orbit-text/70",
  qualified: "bg-emerald-50 text-emerald-700",
  follow_up: "bg-amber-50 text-amber-800",
  unqualified: "bg-orbit-text/[0.06] text-orbit-text/55",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
};

function Pill({ value }) {
  if (!value || value === "unknown") return <span className="text-orbit-text/40">—</span>;
  const label = String(value).replace(/_/g, " ");
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_CLS[value] || "bg-orbit-text/[0.06] text-orbit-text/65"}`}>
      {label}
    </span>
  );
}

function Cell({ label, value }) {
  return (
    <div className="rounded-xl bg-orbit-sand p-3">
      <div className="text-xs text-orbit-text/40">{label}</div>
      <div className="font-medium truncate text-sm">{value || "—"}</div>
    </div>
  );
}

export default function Leads() {
  const { data: items, setData: setItems, error, loading, reload: load } = useApiResource("/tenant/leads");
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [notes, setNotes] = useState("");
  const [followAt, setFollowAt] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [err, setErr] = useState("");


  const open = async (row) => {
    setActive(row);
    setDetail(null);
    setErr("");
    try {
      const r = await api.get(`/tenant/leads/${row.id}`);
      setDetail(r.data);
      setNotes(r.data.notes || "");
      setFollowAt(r.data.follow_up_at ? String(r.data.follow_up_at).slice(0, 16) : "");
      setLostReason(r.data.lost_reason || "");
    } catch (e) {
      setErr(formatApiErrorDetail(e?.response?.data?.detail));
    }
  };

  const apply = async (payload) => {
    if (!active) return;
    setErr("");
    try {
      const r = await api.patch(`/tenant/leads/${active.id}`, payload);
      setDetail((d) => ({ ...(d || {}), ...r.data }));
      setItems((rows) => (rows || []).map((x) => (x.id === active.id ? { ...x, ...r.data } : x)));
    } catch (e) {
      setErr(e?.response?.data?.detail || "Could not update this enquiry.");
    }
  };

  return (
    <div className="space-y-8" data-testid="tenant-leads">
      <PageHeader eyebrow={'Follow-ups'} title={'Leads'} subtitle={'Inbound enquiries for follow-up. This is not a CRM.'} />

      <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] overflow-hidden">
        {loading && <Loading />}
        {error && <LoadError error={error} onRetry={load} className="m-4" />}
        {!loading && !error && items?.length === 0 && (
          <div className="p-10 text-center text-sm text-orbit-text/55">No enquiries yet.</div>
        )}
        {items?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-orbit-text/40 border-b border-black/5">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Requirement</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Follow-up</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => open(l)}
                    data-testid="lead-row"
                    className="border-b border-black/5 last:border-0 hover:bg-orbit-sand cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium truncate">{l.customer_name || l.customer_phone || "—"}</div>
                      {l.customer_name && l.customer_phone && (
                        <div className="text-xs text-orbit-text/40 truncate">{l.customer_phone}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 capitalize text-orbit-text/65">{l.source || "unknown"}</td>
                    <td className="px-3 py-3 text-orbit-text/65 max-w-xs truncate">{l.enquiry_summary || l.service_category || "—"}</td>
                    <td className="px-3 py-3"><Pill value={l.lead_status} /></td>
                    <td className="px-3 py-3">
                      {l.owner_callback_requested ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">Owner callback requested</span>
                      ) : l.follow_up_due ? (
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">Follow-up due</span>
                      ) : l.follow_up_required ? (
                        <span className="text-[10px] bg-orbit-text/[0.06] text-orbit-text/65 font-medium px-2 py-0.5 rounded-full">Follow-up</span>
                      ) : (
                        <span className="text-orbit-text/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-orbit-text/40 whitespace-nowrap">
                      {l.created_at ? new Date(l.created_at).toLocaleString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="lead-detail">
          <SheetHeader>
            <SheetTitle className="font-display">{detail?.customer_name || active?.customer_name || "Enquiry"}</SheetTitle>
          </SheetHeader>
          {!detail && err ? (
            <LoadError error={err} onRetry={() => open(active)} className="mt-6" />
          ) : !detail ? (
            <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>
          ) : (
            <div className="mt-4 space-y-6">
              {detail.owner_callback_requested && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="owner-callback-banner">
                  Owner callback requested
                  {detail.owner_callback_requested_at && (
                    <div className="text-xs text-amber-800/80 mt-1">
                      {new Date(detail.owner_callback_requested_at).toLocaleString("en-IN")}
                    </div>
                  )}
                  {detail.owner_callback_status && (
                    <div className="text-xs capitalize mt-0.5">Status: {detail.owner_callback_status}</div>
                  )}
                </div>
              )}
              {detail.follow_up_due && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="follow-up-due-banner">
                  Follow-up due
                  {detail.follow_up_at && (
                    <div className="text-xs text-amber-800/80 mt-1">
                      {new Date(detail.follow_up_at).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Cell label="Customer" value={detail.customer_name} />
                <Cell label="Phone" value={detail.customer_phone} />
                <Cell label="WhatsApp" value={detail.customer_whatsapp} />
                <Cell label="Email" value={detail.customer_email} />
                <Cell label="Source" value={detail.source} />
                <Cell label="Service" value={detail.service_category} />
                <Cell label="Location" value={detail.location} />
                <Cell label="Budget" value={detail.budget_value != null ? String(detail.budget_value) : null} />
                <Cell label="Timeline" value={detail.timeline} />
                <Cell label="Qualification" value={detail.qualification_status} />
              </div>

              {detail.enquiry_summary && (
                <div>
                  <div className="text-sm font-semibold mb-2">Requirement</div>
                  <p className="text-sm text-orbit-text/65 leading-relaxed">{detail.enquiry_summary}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 items-center">
                <Pill value={detail.lead_status} />
                {detail.lead_score != null && (
                  <span className="text-[10px] bg-orbit-text/[0.06] text-orbit-text/65 font-medium px-2 py-0.5 rounded-full">Score {detail.lead_score}</span>
                )}
                {detail.buying_intent && <span className="text-xs text-orbit-text/55">Intent: {detail.buying_intent}</span>}
                {detail.urgency && <span className="text-xs text-orbit-text/55">Urgency: {detail.urgency}</span>}
                {detail.follow_up_due && <Pill value="follow_up" />}
              </div>

              <div>
                <div className="text-xs text-orbit-text/40 mb-2">Actions</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" data-testid="lead-mark-contacted" onClick={() => apply({ lead_status: "contacted" })} className="text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand">Mark contacted</button>
                  <button type="button" data-testid="lead-mark-qualified" onClick={() => apply({ lead_status: "qualified" })} className="text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand">Mark qualified</button>
                  <button type="button" data-testid="lead-mark-won" onClick={() => apply({ lead_status: "won" })} className="text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand">Mark won</button>
                  <button type="button" data-testid="lead-mark-lost" onClick={() => apply({ lead_status: "lost", lost_reason: lostReason || undefined })} className="text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand">Mark lost</button>
                </div>
                <Input
                  placeholder="Why was it lost? (optional — fill before marking lost)"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="h-9 text-sm mt-2"
                  data-testid="lead-lost-reason"
                />
                {err && <p className="text-xs text-red-600 mt-2">{typeof err === "string" ? err : "Update rejected"}</p>}
              </div>

              <div>
                <div className="text-xs text-orbit-text/40 mb-2">Schedule follow-up</div>
                <div className="flex gap-2">
                  <Input type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} className="h-9 text-sm" data-testid="lead-follow-up-at" />
                  <button
                    type="button"
                    data-testid="lead-schedule-follow-up"
                    onClick={() => apply({ lead_status: "follow_up", follow_up_required: true, follow_up_at: followAt || undefined, notes })}
                    className="text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand shrink-0"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Notes</div>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm min-h-[72px]" data-testid="lead-notes" />
                <button type="button" onClick={() => apply({ notes })} className="mt-2 text-xs rounded-full px-3 py-1 border border-black/10 text-orbit-text/65 hover:bg-orbit-sand">Save notes</button>
              </div>

              {detail.conversation && (
                <div className="rounded-xl border border-black/5 px-4 py-3 text-sm">
                  <div className="text-xs text-orbit-text/40">Conversation</div>
                  <div className="font-medium mt-0.5">{detail.conversation.summary_title || "Linked conversation"}</div>
                  {detail.conversation.summary && (
                    <p className="text-xs text-orbit-text/55 mt-1 leading-relaxed">{detail.conversation.summary}</p>
                  )}
                  <div className="text-xs text-orbit-text/40 mt-2 font-mono">{detail.conversation_id}</div>
                  <Link to="/dashboard/conversations" className="text-xs underline underline-offset-2 text-orbit-text/65 mt-2 inline-block">Open conversations</Link>
                </div>
              )}

              {(detail.callback_requests || []).length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">Owner callbacks</div>
                  {(detail.callback_requests || []).map((cb) => (
                    <div key={cb.id} className="text-sm text-orbit-text/65 rounded-xl bg-orbit-sand p-3 mb-2">
                      <div className="capitalize">{cb.status}</div>
                      {cb.reason && <div className="text-xs text-orbit-text/55 mt-1">{cb.reason}</div>}
                      <div className="text-xs text-orbit-text/40 mt-1">{cb.requested_at ? new Date(cb.requested_at).toLocaleString("en-IN") : ""}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-orbit-text/40">
                {detail.created_at ? new Date(detail.created_at).toLocaleString("en-IN") : ""}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
