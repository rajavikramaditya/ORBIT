import { useEffect, useState } from "react";
import { Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useApiResource } from "@/hooks/useApiResource";
import { Loading, LoadError } from "@/components/AsyncState";

function DangerZone() {
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwner = user?.role === "owner";
  const load = () => api.get("/tenant/deletion-request").then((r) => setRequest(r.data)).catch(() => setRequest(null)).finally(() => setLoaded(true));
  useEffect(() => { if (isOwner) load(); }, [isOwner]);

  if (!isOwner) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await api.post("/tenant/deletion-request", { reason });
      toast.success("Deletion request sent to ORBIT");
      setOpen(false);
      setReason("");
      setConfirmText("");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      await api.post("/tenant/deletion-request/cancel");
      toast.success("Deletion request cancelled");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 space-y-4" data-testid="danger-zone">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4.5 h-4.5 text-red-500 mt-0.5 shrink-0" />
        <div>
          <h2 className="font-display text-lg font-semibold text-red-900">Danger zone</h2>
          <p className="mt-1 text-sm text-red-800/80 leading-relaxed">
            Deleting your account permanently removes your business profile, AI employee, channels,
            conversations and leads. This cannot be undone once ORBIT confirms it.
          </p>
        </div>
      </div>

      {request ? (
        <div className="rounded-xl bg-white border border-red-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-700">
            Deletion requested on {new Date(request.created_at).toLocaleDateString("en-IN")} — ORBIT will confirm shortly.
          </p>
          <Button variant="outline" size="sm" onClick={cancel} disabled={saving} data-testid="cancel-deletion-request" className="rounded-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel request"}
          </Button>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" data-testid="delete-account-btn" className="rounded-full h-10 px-5">
              Delete my account
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="delete-account-dialog">
            <DialogHeader><DialogTitle className="font-display">Delete your account?</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-zinc-600 leading-relaxed">
                This sends a deletion request to ORBIT. Nothing is deleted immediately — our team confirms
                it and your data is permanently removed shortly after.
              </p>
              <div>
                <Label className="text-sm">Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Let us know why you're leaving…" rows={3} className="mt-1.5" data-testid="delete-reason" />
              </div>
              <div>
                <Label className="text-sm">Type DELETE to confirm</Label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE" className="mt-1.5" data-testid="delete-confirm-input" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={saving || confirmText !== "DELETE"} variant="destructive"
                data-testid="delete-confirm-submit" className="rounded-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request deletion"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

const BUSINESS_TYPES = [
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "salon", label: "Salon" },
  { value: "clinic", label: "Clinic" },
  { value: "retail", label: "Retail" },
  { value: "other", label: "Other" },
];

const BRAND_SWATCHES = ["#18181B", "#1E3A5F", "#7A5C2E", "#3F3F46", "#155E4B", "#7C2D12"];

export default function Settings() {
  const { user, setUser } = useAuth();
  const { data: t, setData: setT, error, loading, reload } = useApiResource("/tenant/profile");
  const [saving, setSaving] = useState(false);

  const setName = (v) => setT((p) => ({ ...p, name: v }));
  const setProfile = (k, v) => setT((p) => ({ ...p, profile: { ...(p.profile || {}), [k]: v } }));
  const setBrand = (v) => setT((p) => ({ ...p, branding: { ...(p.branding || {}), brand_color: v } }));
  const setBusinessType = (v) => setT((p) => ({ ...p, business_type: v }));

  const save = async () => {
    setSaving(true);
    try {
      const profile = t.profile || {};
      const branding = t.branding || {};
      const payload = {
        name: t.name,
        business_type: t.business_type || "hotel",
        website: profile.website,
        address: profile.address,
        contact_email: profile.contact_email,
        contact_phone: profile.contact_phone,
        description: profile.description,
        logo_url: profile.logo_url || branding.logo_url || "",
        brand_color: branding.brand_color,
      };
      const r = await api.patch("/tenant/profile", payload);
      setT(r.data);
      setUser({ ...user, tenant: { ...user.tenant, name: r.data.name, branding: r.data.branding } });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <LoadError error={error} onRetry={reload} />;
  if (!t) return null;

  // The API can legitimately return a tenant with no profile/branding block yet
  // (a freshly created account) — reading through them directly crashed the page.
  const profile = t.profile || {};
  const branding = t.branding || {};

  return (
    <div className="space-y-8 max-w-3xl" data-testid="tenant-settings">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">Manage your business profile and branding.</p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold">Business profile</h2>
        {!(t.profile?.contact_email && t.profile?.contact_phone && t.profile?.address) && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            Contact email, phone and address are needed before ORBIT can take this workspace live.
          </p>
        )}
        <div>
          <Label className="text-sm">Business name</Label>
          <Input value={t.name || ""} onChange={(e) => setName(e.target.value)} placeholder="Business / Property name" className="mt-1.5" data-testid="settings-name" />
        </div>
        <div>
          <Label className="text-sm">Business type</Label>
          <Select value={t.business_type || "hotel"} onValueChange={setBusinessType}>
            <SelectTrigger className="mt-1.5" data-testid="settings-business-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-zinc-400">Changes which fields show on your Business Data page.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Website</Label>
            <Input value={profile.website || ""} onChange={(e) => setProfile("website", e.target.value)} placeholder="https://…" className="mt-1.5" data-testid="settings-website" />
          </div>
          <div>
            <Label className="text-sm">Contact phone</Label>
            <Input value={profile.contact_phone || ""} onChange={(e) => setProfile("contact_phone", e.target.value)} placeholder="+91 …" className="mt-1.5" data-testid="settings-phone" />
          </div>
        </div>
        <div>
          <Label className="text-sm">Contact email</Label>
          <Input value={profile.contact_email || ""} onChange={(e) => setProfile("contact_email", e.target.value)} placeholder="contact@business.in" className="mt-1.5" data-testid="settings-email" />
        </div>

        <div>
          <Label className="text-sm">Address</Label>
          <Input value={profile.address || ""} onChange={(e) => setProfile("address", e.target.value)} placeholder="Street, City, PIN" className="mt-1.5" data-testid="settings-address" />
        </div>
        <div>
          <Label className="text-sm">Description</Label>
          <Textarea value={profile.description || ""} onChange={(e) => setProfile("description", e.target.value)} placeholder="A short description of your property" rows={3} className="mt-1.5" data-testid="settings-description" />
        </div>
        <div>
          <Label className="text-sm">Logo URL</Label>
          <Input value={profile.logo_url || ""} onChange={(e) => setProfile("logo_url", e.target.value)} placeholder="https://…/logo.png" className="mt-1.5" data-testid="settings-logo" />
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Brand colour</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {BRAND_SWATCHES.map((c) => (
            <button key={c} onClick={() => setBrand(c)} data-testid={`swatch-${c}`}
              className={`w-9 h-9 rounded-xl transition-transform hover:scale-105 ${branding.brand_color === c ? "ring-2 ring-offset-2 ring-zinc-900" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
          <Input value={branding.brand_color || ""} onChange={(e) => setBrand(e.target.value)} className="w-32 h-9" data-testid="settings-brand_color" />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 flex items-start gap-3">
        <Lock className="w-4.5 h-4.5 text-zinc-400 mt-0.5 shrink-0" />
        <p className="text-sm text-zinc-500 leading-relaxed">
          AI prompts, knowledge base, tools and voice behaviour are ORBIT-managed and can't be edited here — submit a
          Customization request instead.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} data-testid="settings-save" className="rounded-full h-11 px-6 bg-zinc-900 hover:bg-zinc-800">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>

      <DangerZone />
    </div>
  );
}
