import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowDownLeft, ArrowUpRight, Info, AudioLines } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader, InfoNote } from "@/components/AppUI";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

export default function Conversations() {
  const { data: items, error, loading, reload } = useApiResource("/tenant/conversations");
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState(null);

  const open = async (c) => {
    setActive(c);
    setDetail(null);
    setDetailError(null);
    try {
      const r = await api.get(`/tenant/conversations/${c.id}`);
      setDetail(r.data);
    } catch (e) {
      // Opening a call used to fail in total silence — an endless spinner in
      // the panel with no way to tell it had given up.
      setDetailError(formatApiErrorDetail(e?.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-8" data-testid="tenant-conversations">
      <PageHeader eyebrow={'Every call'} title={'Conversations'} subtitle={'Every call captured, transcribed and summarised.'} />

      <InfoNote icon={Info} tone="gold">
          Callers interact with an AI assistant, not a human. Conversations may be recorded and transcribed for your workspace.
          See the public <Link to="/ai-disclosure" className="font-medium underline underline-offset-2">AI & recording disclosure</Link>.
        </InfoNote>

      <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] overflow-hidden">
        {loading && <Loading />}
        {error && <LoadError error={error} onRetry={reload} className="m-4" />}
        {!loading && !error && items?.length === 0 && (
          <div className="p-10 text-center text-sm text-orbit-text/55">No conversations yet.</div>
        )}
        <div className="divide-y divide-black/5">
          {items?.map((c) => (
            <button key={c.id} onClick={() => open(c)} data-testid="conversation-row"
              className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-orbit-sand transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-orbit-text/[0.06] grid place-items-center text-orbit-text/65">
                  {c.direction === "outbound" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{c.summary_title}</span>
                    {c.follow_up_required && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full shrink-0">Follow-up</span>
                    )}
                    {c.outcome && c.outcome !== "resolved" && c.outcome !== "follow_up_required" && (
                      <span className="text-[10px] bg-orbit-text/[0.06] text-orbit-text/65 font-medium px-2 py-0.5 rounded-full capitalize shrink-0">{c.outcome.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <div className="text-xs text-orbit-text/40 truncate">
                    {c.caller_name ? `${c.caller_name} · ` : ""}{c.external_number || "—"} · {new Date(c.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-orbit-text/55">{Math.floor((c.duration_secs || 0) / 60)}m {(c.duration_secs || 0) % 60}s</div>
                {c.call_successful !== undefined && (
                  <div className={`text-[10px] font-medium capitalize ${c.call_successful === true || c.call_successful === "success" ? "text-emerald-600" : "text-amber-600"}`}>
                    {c.call_successful === true || c.call_successful === "success" ? "Resolved" : "Unresolved"}
                  </div>
                )}
              </div>
            </button>

          ))}
        </div>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="conversation-detail">
          <SheetHeader>
            <SheetTitle className="font-display">{active?.summary_title}</SheetTitle>
          </SheetHeader>
          {detailError ? (
            <LoadError error={detailError} onRetry={() => open(active)} className="mt-6" />
          ) : !detail ? (
            <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-orbit-sand p-3"><div className="text-xs text-orbit-text/40">Caller</div><div className="font-medium truncate">{detail.caller_name ? `${detail.caller_name}` : detail.external_number || "—"}</div></div>
                <div className="rounded-xl bg-orbit-sand p-3"><div className="text-xs text-orbit-text/40">Duration</div><div className="font-medium">{Math.floor((detail.duration_secs || 0) / 60)}m {(detail.duration_secs || 0) % 60}s</div></div>
                <div className="rounded-xl bg-orbit-sand p-3"><div className="text-xs text-orbit-text/40">Number</div><div className="font-medium">{detail.external_number || "—"}</div></div>
                <div className="rounded-xl bg-orbit-sand p-3"><div className="text-xs text-orbit-text/40">Status</div><div className="font-medium capitalize">{detail.status}</div></div>
              </div>


              {detail.summary && (
                <div>
                  <div className="text-sm font-semibold mb-2">Summary</div>
                  <p className="text-sm text-orbit-text/65 leading-relaxed">{detail.summary}</p>
                </div>
              )}

              {detail.data_mode && (
                <div className={`rounded-xl border p-3 ${detail.data_mode === "mock" ? "border-amber-200 bg-amber-50" : detail.data_mode === "live" ? "border-emerald-200 bg-emerald-50" : "border-black/[0.08] bg-orbit-sand"}`} data-testid="conversation-data-source">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={detail.data_mode === "mock" ? "text-amber-700" : detail.data_mode === "live" ? "text-emerald-700" : "text-orbit-text/65"}>
                      Data source: {detail.data_mode === "mock" ? "MOCK / demo" : detail.data_mode === "live" ? "Live business data" : "Informational only"}
                    </span>
                  </div>
                  <p className="text-xs text-orbit-text/55 mt-1">{detail.live_data_note}</p>
                  {(detail.tool_invocations || []).map((ti, i) => (
                    <div key={i} className="mt-2 rounded-lg bg-white/70 border border-black/5 p-2 text-xs">
                      <span className="font-mono text-orbit-text/65">{ti.tool}</span>
                      <span className="text-orbit-text/40"> · {ti.status}{ti.mock ? " · MOCK" : ""}</span>
                      {ti.data && <pre className="mt-1 text-[11px] text-orbit-text/65 whitespace-pre-wrap break-words">{JSON.stringify(ti.data)}</pre>}
                    </div>
                  ))}
                </div>
              )}

              {detail.recording_ref && (
              <div className="flex items-center gap-2 rounded-xl border border-black/5 px-4 py-3 text-sm text-orbit-text/55">
                <AudioLines className="w-4 h-4 shrink-0" /> Recording reference: <span className="font-mono text-xs break-all">{detail.recording_ref}</span>
              </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-3">Transcript</div>
                <div className="space-y-3">
                  {(detail.transcript || []).map((t, i) => (
                    <div key={i} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-[22px] px-3.5 py-2.5 text-sm leading-relaxed ${
                        t.role === "agent" ? "bg-orbit-text/[0.06] text-orbit-text/85" : "bg-orbit-text text-white"
                      }`}>
                        <div className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">{t.role === "agent" ? "AI" : "Customer"}</div>
                        {t.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
