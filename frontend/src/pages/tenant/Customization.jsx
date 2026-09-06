import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Wand2, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";
import { PageHeader } from "@/components/AppUI";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  ["system_prompt", "System prompt"],
  ["personality", "AI personality / behaviour"],
  ["knowledge_base", "Knowledge base"],
  ["tools", "Tools & integrations"],
  ["workflows", "Workflows"],
  ["voice", "Voice behaviour"],
  ["other", "Other"],
];

const CAT_LABEL = Object.fromEntries(CATEGORIES);

const BLANK_FORM = { category: "knowledge_base", title: "", details: "", priority: "normal" };

export default function Customization() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: items, error, loading, reload: load } = useApiResource("/tenant/customization-requests");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [quickAsk, setQuickAsk] = useState(null); // null = full form; string = the step label it arrived from
  const [form, setForm] = useState(BLANK_FORM);

  // Arriving from the Overview onboarding wizard's "Ask ORBIT about this" opens
  // the same request dialog, but a first-time owner shouldn't have to make sense
  // of ORBIT's internal category taxonomy — that version of the dialog collapses
  // to one plain-language question box instead (see the `quickAsk` branch below).
  useEffect(() => {
    const ask = searchParams.get("ask");
    if (!ask) return;
    const label = searchParams.get("label") || ask;
    setQuickAsk(label);
    setForm({ ...BLANK_FORM, category: "other", title: `Question: ${label}` });
    setOpen(true);
    // Clear the query params so refreshing/closing doesn't reopen the dialog.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeDialog = () => {
    setOpen(false);
    setSent(false);
    setQuickAsk(null);
    setForm(BLANK_FORM);
  };

  const submit = async () => {
    if (!form.details || (!quickAsk && !form.title)) {
      toast.error(quickAsk ? "Please write your question first" : "Please add a title and details");
      return;
    }
    setSaving(true);
    try {
      await api.post("/tenant/customization-requests", form);
      setSent(true);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="tenant-customization">
      <PageHeader eyebrow={'Managed changes'} title={'Customization'} subtitle={'Request managed changes to how your AI employees behave.'} actions={
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button data-testid="new-request-btn" className="rounded-full h-11 px-5 bg-orbit-text hover:bg-orbit-text/90">
              <Plus className="w-4 h-4 mr-2" /> New request
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="new-request-dialog">
            {sent ? (
              <div className="py-4 text-center space-y-4" data-testid="request-sent-confirmation">
                <span className="w-12 h-12 rounded-[22px] bg-emerald-50 text-emerald-600 grid place-items-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold">Sent</p>
                  <p className="mt-1.5 text-sm text-orbit-text/55 leading-relaxed">
                    ORBIT usually replies within 1 business day.
                  </p>
                </div>
                <Button onClick={closeDialog} data-testid="request-sent-done" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
                  Done
                </Button>
              </div>
            ) : quickAsk ? (
              <>
                <DialogHeader><DialogTitle className="font-display">Ask ORBIT: {quickAsk}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })}
                    data-testid="request-details" placeholder="What would you like to ask or tell us?" rows={5} autoFocus />
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={saving} data-testid="request-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader><DialogTitle className="font-display">New customization request</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label className="text-sm">Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger className="mt-1.5" data-testid="request-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Title</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                      data-testid="request-title" placeholder="e.g. Add spa menu to knowledge base" className="mt-1.5" />
                  </div>
                  <div>
                    <Label className="text-sm">Details</Label>
                    <Textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })}
                      data-testid="request-details" placeholder="Describe what you'd like changed…" rows={4} className="mt-1.5" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={saving} data-testid="request-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit request"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      } />

      {loading && <Loading />}
      {error && <LoadError error={error} onRetry={load} />}
      {!loading && !error && items?.length === 0 && (
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-12 text-center">
          <span className="w-12 h-12 rounded-[22px] bg-orbit-text/[0.06] grid place-items-center mx-auto text-orbit-text/55"><Wand2 className="w-5 h-5" /></span>
          <p className="mt-4 text-sm text-orbit-text/55">No requests yet. Submit one to have ORBIT tune your AI employee.</p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((r) => (
          <div key={r.id} className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5" data-testid="request-card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs rounded-full bg-orbit-text/[0.06] text-orbit-text/65 px-2 py-0.5">{CAT_LABEL[r.category] || r.category}</span>
                  <StatusBadge kind="request" value={r.status} testid="request-status" />
                </div>
                <div className="mt-2 text-sm font-semibold">{r.title}</div>
                <p className="mt-1 text-sm text-orbit-text/55 leading-relaxed">{r.details}</p>
                {r.admin_notes && <p className="mt-2 text-xs text-orbit-text/55"><span className="font-medium text-orbit-text/75">ORBIT:</span> {r.admin_notes}</p>}
              </div>
              <div className="text-xs text-orbit-text/40 shrink-0">{new Date(r.created_at).toLocaleDateString("en-IN")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
