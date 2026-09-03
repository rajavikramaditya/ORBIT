import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneCall, Loader2, ArrowDownLeft, ArrowUpRight, Info, Play } from "lucide-react";
import { api } from "@/lib/api";

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

export default function Conversations() {
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/tenant/conversations").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  const open = async (c) => {
    setActive(c);
    setDetail(null);
    try {
      const r = await api.get(`/tenant/conversations/${c.id}`);
      setDetail(r.data);
    } catch (e) { /* noop */ }
  };

  return (
    <div className="space-y-8" data-testid="tenant-conversations">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Conversations</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">Every call captured, transcribed and summarised.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4">
        <Info className="w-4.5 h-4.5 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-900/80 leading-relaxed">
          Callers interact with an AI assistant, not a human. Conversations may be recorded and transcribed for your workspace.
          See the public <Link to="/ai-disclosure" className="font-medium underline underline-offset-2">AI & recording disclosure</Link>.
        </p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white overflow-hidden">
        {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
        {items && items.length === 0 && (
          <div className="p-10 text-center text-sm text-zinc-500">No conversations yet.</div>
        )}
        <div className="divide-y divide-black/5">
          {items?.map((c) => (
            <button key={c.id} onClick={() => open(c)} data-testid="conversation-row"
              className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-zinc-100 grid place-items-center text-zinc-600">
                  {c.direction === "outbound" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{c.summary_title}</span>
                    {c.follow_up_required && (
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full shrink-0">Follow-up</span>
                    )}
                    {c.outcome && c.outcome !== "resolved" && c.outcome !== "follow_up_required" && (
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 font-medium px-2 py-0.5 rounded-full capitalize shrink-0">{c.outcome.replace(/_/g, " ")}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 truncate">
                    {c.caller_name ? `${c.caller_name} · ` : ""}{c.external_number || "—"} · {new Date(c.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-zinc-500">{Math.floor((c.duration_secs || 0) / 60)}m {(c.duration_secs || 0) % 60}s</div>
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
          {!detail ? (
            <div className="py-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>
          ) : (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-400">Caller</div><div className="font-medium truncate">{detail.caller_name ? `${detail.caller_name}` : detail.external_number || "—"}</div></div>
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-400">Duration</div><div className="font-medium">{Math.floor((detail.duration_secs || 0) / 60)}m {(detail.duration_secs || 0) % 60}s</div></div>
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-400">Number</div><div className="font-medium">{detail.external_number || "—"}</div></div>
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-400">Status</div><div className="font-medium capitalize">{detail.status}</div></div>
              </div>


              {detail.summary && (
                <div>
                  <div className="text-sm font-semibold mb-2">Summary</div>
                  <p className="text-sm text-zinc-600 leading-relaxed">{detail.summary}</p>
                </div>
              )}

              {detail.data_mode && (
                <div className={`rounded-xl border p-3 ${detail.data_mode === "mock" ? "border-amber-200 bg-amber-50" : detail.data_mode === "live" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`} data-testid="conversation-data-source">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className={detail.data_mode === "mock" ? "text-amber-700" : detail.data_mode === "live" ? "text-emerald-700" : "text-zinc-600"}>
                      Data source: {detail.data_mode === "mock" ? "MOCK / demo" : detail.data_mode === "live" ? "Live business data" : "Informational only"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{detail.live_data_note}</p>
                  {(detail.tool_invocations || []).map((ti, i) => (
                    <div key={i} className="mt-2 rounded-lg bg-white/70 border border-black/5 p-2 text-xs">
                      <span className="font-mono text-zinc-600">{ti.tool}</span>
                      <span className="text-zinc-400"> · {ti.status}{ti.mock ? " · MOCK" : ""}</span>
                      {ti.data && <pre className="mt-1 text-[11px] text-zinc-600 whitespace-pre-wrap break-words">{JSON.stringify(ti.data)}</pre>}
                    </div>
                  ))}
                </div>
              )}

              {detail.recording_ref && (
              <div className="flex items-center gap-2 rounded-xl border border-black/5 px-4 py-3 text-sm text-zinc-500">
                <Play className="w-4 h-4" /> Recording reference: <span className="font-mono text-xs break-all">{detail.recording_ref}</span>
              </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-3">Transcript</div>
                <div className="space-y-3">
                  {(detail.transcript || []).map((t, i) => (
                    <div key={i} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        t.role === "agent" ? "bg-zinc-100 text-zinc-800" : "bg-zinc-900 text-white"
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
