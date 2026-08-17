import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const BRAND_SWATCHES = ["#18181B", "#1E3A5F", "#7A5C2E", "#3F3F46", "#155E4B", "#7C2D12"];

export default function Settings() {
  const { user, setUser } = useAuth();
  const [t, setT] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/tenant/profile").then((r) => setT(r.data)).catch(() => {});
  }, []);

  const setName = (v) => setT((p) => ({ ...p, name: v }));
  const setProfile = (k, v) => setT((p) => ({ ...p, profile: { ...p.profile, [k]: v } }));
  const setBrand = (v) => setT((p) => ({ ...p, branding: { ...p.branding, brand_color: v } }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: t.name,
        website: t.profile.website,
        address: t.profile.address,
        contact_email: t.profile.contact_email,
        contact_phone: t.profile.contact_phone,
        description: t.profile.description,
        logo_url: t.profile.logo_url || t.branding.logo_url || "",
        brand_color: t.branding.brand_color,
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

  if (!t) return <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>;

  return (
    <div className="space-y-8 max-w-3xl" data-testid="tenant-settings">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-zinc-500 text-sm">Manage your business profile and branding.</p>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold">Business profile</h2>
        <div>
          <Label className="text-sm">Hotel name</Label>
          <Input value={t.name || ""} onChange={(e) => setName(e.target.value)} placeholder="The Grand Palace" className="mt-1.5" data-testid="settings-name" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Website</Label>
            <Input value={t.profile.website || ""} onChange={(e) => setProfile("website", e.target.value)} placeholder="https://…" className="mt-1.5" data-testid="settings-website" />
          </div>
          <div>
            <Label className="text-sm">Contact phone</Label>
            <Input value={t.profile.contact_phone || ""} onChange={(e) => setProfile("contact_phone", e.target.value)} placeholder="+91 …" className="mt-1.5" data-testid="settings-phone" />
          </div>
        </div>
        <div>
          <Label className="text-sm">Contact email</Label>
          <Input value={t.profile.contact_email || ""} onChange={(e) => setProfile("contact_email", e.target.value)} placeholder="frontdesk@hotel.in" className="mt-1.5" data-testid="settings-email" />
        </div>
        <div>
          <Label className="text-sm">Address</Label>
          <Input value={t.profile.address || ""} onChange={(e) => setProfile("address", e.target.value)} placeholder="Street, City, PIN" className="mt-1.5" data-testid="settings-address" />
        </div>
        <div>
          <Label className="text-sm">Description</Label>
          <Textarea value={t.profile.description || ""} onChange={(e) => setProfile("description", e.target.value)} placeholder="A short description of your property" rows={3} className="mt-1.5" data-testid="settings-description" />
        </div>
        <div>
          <Label className="text-sm">Logo URL</Label>
          <Input value={t.profile.logo_url || ""} onChange={(e) => setProfile("logo_url", e.target.value)} placeholder="https://…/logo.png" className="mt-1.5" data-testid="settings-logo" />
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold">Brand colour</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {BRAND_SWATCHES.map((c) => (
            <button key={c} onClick={() => setBrand(c)} data-testid={`swatch-${c}`}
              className={`w-9 h-9 rounded-xl transition-transform hover:scale-105 ${t.branding.brand_color === c ? "ring-2 ring-offset-2 ring-zinc-900" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
          <Input value={t.branding.brand_color || ""} onChange={(e) => setBrand(e.target.value)} className="w-32 h-9" data-testid="settings-brand_color" />
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
    </div>
  );
}
