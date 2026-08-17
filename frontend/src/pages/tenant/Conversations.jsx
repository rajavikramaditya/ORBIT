import { useEffect, useState } from "react";
import { PhoneCall, Loader2, ArrowDownLeft, ArrowUpRight, Play } from "lucide-react";
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
                  <div className="text-sm font-medium truncate">{c.summary_title}</div>
                  <div className="text-xs text-zinc-400 truncate">{c.external_number || "—"} · {new Date(c.created_at).toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div className="text-xs text-zinc-500 shrink-0">{Math.floor((c.duration_secs || 0) / 60)}m {(c.duration_secs || 0) % 60}s</div>
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
                <div className="rounded-xl bg-zinc-50 p-3"><div className="text-xs text-zinc-400">Direction</div><div className="font-medium capitalize">{detail.direction}</div></div>
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

              <div className="flex items-center gap-2 rounded-xl border border-black/5 px-4 py-3 text-sm text-zinc-500">
                <Play className="w-4 h-4" /> Recording: <span className="font-mono text-xs">{detail.recording_ref}</span>
              </div>

              <div>
                <div className="text-sm font-semibold mb-3">Transcript</div>
                <div className="space-y-3">
                  {(detail.transcript || []).map((t, i) => (
                    <div key={i} className={`flex ${t.role === "agent" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        t.role === "agent" ? "bg-zinc-100 text-zinc-800" : "bg-zinc-900 text-white"
                      }`}>
                        <div className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">{t.role === "agent" ? "Aria" : "Guest"}</div>
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
