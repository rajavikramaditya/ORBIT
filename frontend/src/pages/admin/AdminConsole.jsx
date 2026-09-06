import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Plus, Loader2, Building2, Bot, Radio, MessagesSquare,
  Wand2, ShieldAlert, ChevronRight, Link2, KeyRound, Receipt, BookOpen,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { OrbitLogo } from "@/components/OrbitLogo";
import { PageHeader } from "@/components/AppUI";
import { Loading, LoadError } from "@/components/AsyncState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NEXT_STATE = {
  draft: ["testing"],
  testing: ["approved", "draft"],
  approved: ["live", "testing"],
  live: ["suspended"],
  suspended: ["live"],
};
const ACTION_LABEL = {
  testing: "Start testing",
  approved: "Approve",
  live: "Go live",
  suspended: "Suspend",
  draft: "Back to draft",
};
const REQUEST_STATES = ["submitted", "in_review", "in_progress", "completed", "rejected"];

// Kept local (the admin row is 7-wide and denser than the tenant one) but now
// drawn with the same border, radius and numeral treatment as StatTile.
function StatPill({ icon: Icon, label, value, testid }) {
  return (
    <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-4 flex items-center gap-3" data-testid={testid}>
      <span className="w-10 h-10 rounded-xl bg-orbit-text/[0.06] grid place-items-center text-orbit-text/75"><Icon className="w-4.5 h-4.5" strokeWidth={1.7} /></span>
      <div>
        <div className="font-display text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-xs text-orbit-text/55">{label}</div>
      </div>
    </div>
  );
}

function CreateTenantDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: "", owner_name: "", owner_email: "", owner_password: "", brand_color: "#18181B", business_type: "hotel" });
  const submit = async () => {
    if (!f.name || !f.owner_email || !f.owner_password) { toast.error("Name, owner email and password are required"); return; }
    setSaving(true);
    try {
      await api.post("/admin/tenants", f);
      toast.success("Tenant created");
      setOpen(false);
      setF({ name: "", owner_name: "", owner_email: "", owner_password: "", brand_color: "#18181B", business_type: "hotel" });
      onCreated();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-tenant-btn" className="rounded-full h-10 px-5 bg-orbit-text hover:bg-orbit-text/90"><Plus className="w-4 h-4 mr-2" /> Create tenant</Button>
      </DialogTrigger>
      <DialogContent data-testid="create-tenant-dialog">
        <DialogHeader><DialogTitle className="font-display">Onboard a new business</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Business name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Business / Property name" className="mt-1.5" data-testid="ct-name" /></div>
          <div><Label className="text-sm">Business type</Label>
            <Select value={f.business_type} onValueChange={(v) => setF({ ...f, business_type: v })}>
              <SelectTrigger className="mt-1.5" data-testid="ct-business-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hotel">Hotel</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="salon">Salon</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-sm">Owner name</Label>
              <Input value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} placeholder="Owner name" className="mt-1.5" data-testid="ct-owner-name" /></div>
            <div><Label className="text-sm">Brand colour</Label>
              <Input value={f.brand_color} onChange={(e) => setF({ ...f, brand_color: e.target.value })} className="mt-1.5" data-testid="ct-brand" /></div>
          </div>
          <div><Label className="text-sm">Owner email</Label>
            <Input type="email" value={f.owner_email} onChange={(e) => setF({ ...f, owner_email: e.target.value })} placeholder="owner@business.in" className="mt-1.5" data-testid="ct-owner-email" /></div>

          <div><Label className="text-sm">Temporary password</Label>
            <Input value={f.owner_password} onChange={(e) => setF({ ...f, owner_password: e.target.value })} placeholder="min 6 characters" className="mt-1.5" data-testid="ct-owner-password" /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="ct-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachAgentDialog({ tenantId, onDone }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: "", role_title: "Front Desk Concierge", provider: "elevenlabs", provider_agent_id: "", voice_name: "Aria", voice_description: "Warm, professional Indian English" });
  const submit = async () => {
    if (!f.name || !f.provider_agent_id) { toast.error("Name and provider_agent_id are required"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/ai-employees`, f);
      toast.success("AI employee created (Draft)");
      setOpen(false);
      setF({ name: "", role_title: "Front Desk Concierge", provider: "elevenlabs", provider_agent_id: "", voice_name: "Aria", voice_description: "Warm, professional Indian English" });
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full h-8" data-testid="attach-agent-btn"><Link2 className="w-3.5 h-3.5 mr-1.5" /> Attach AI employee</Button>
      </DialogTrigger>
      <DialogContent data-testid="attach-agent-dialog">
        <DialogHeader><DialogTitle className="font-display">Attach voice agent</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Aria" className="mt-1.5" data-testid="aa-name" /></div>
          <div><Label className="text-sm">Role title</Label>
            <Input value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })} className="mt-1.5" data-testid="aa-role" /></div>
          <div><Label className="text-sm">Voice provider</Label>
            <Select value={f.provider} onValueChange={(v) => setF({ ...f, provider: v })}>
              <SelectTrigger className="mt-1.5" data-testid="aa-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-orbit-text/40 mt-1">More providers appear here once connected — no code change needed to pick them.</p>
          </div>
          <div><Label className="text-sm">provider_agent_id</Label>
            <Input value={f.provider_agent_id} onChange={(e) => setF({ ...f, provider_agent_id: e.target.value })} placeholder="agent_xxx" className="mt-1.5 font-mono text-sm" data-testid="aa-agent-id" /></div>
          <div><Label className="text-sm">Voice</Label>
            <Input value={f.voice_name} onChange={(e) => setF({ ...f, voice_name: e.target.value })} className="mt-1.5" data-testid="aa-voice" /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="aa-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectChannelDialog({ tenantId, aiEmployees, onDone }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ type: "phone", connected_identifier: "", assigned_ai_employee_id: "" });
  const submit = async () => {
    if (!f.connected_identifier) { toast.error("Number / account is required"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/channels`, { ...f, assigned_ai_employee_id: f.assigned_ai_employee_id || null });
      toast.success("Channel connected");
      setOpen(false);
      setF({ type: "phone", connected_identifier: "", assigned_ai_employee_id: "" });
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full h-8" data-testid="connect-channel-btn"><Radio className="w-3.5 h-3.5 mr-1.5" /> Connect channel</Button>
      </DialogTrigger>
      <DialogContent data-testid="connect-channel-dialog">
        <DialogHeader><DialogTitle className="font-display">Connect a channel</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Type</Label>
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
              <SelectTrigger className="mt-1.5" data-testid="cc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone (Exotel)</SelectItem>
                <SelectItem value="whatsapp">WhatsApp (ElevenLabs)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-sm">{f.type === "phone" ? "Phone number" : "WhatsApp number/account"}</Label>
            <Input value={f.connected_identifier} onChange={(e) => setF({ ...f, connected_identifier: e.target.value })} placeholder="+91 …" className="mt-1.5" data-testid="cc-identifier" /></div>
          <div><Label className="text-sm">Assign AI employee</Label>
            <Select value={f.assigned_ai_employee_id} onValueChange={(v) => setF({ ...f, assigned_ai_employee_id: v })}>
              <SelectTrigger className="mt-1.5" data-testid="cc-assign"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {(aiEmployees || []).map((ae) => <SelectItem key={ae.id} value={ae.id}>{ae.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="cc-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddIntegrationDialog({ tenantId, environment, onDone }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectors, setConnectors] = useState([]);
  const isProd = environment === "production";
  const [f, setF] = useState({ type: "pms", name: "", connector_key: "mock_pms", mode: "mock" });
  useEffect(() => {
    if (!open) return;
    setF({ type: "pms", name: "", connector_key: isProd ? "custom" : "mock_pms", mode: isProd ? "live" : "mock" });
    api.get("/admin/connectors").then((r) => setConnectors(r.data)).catch(() => setConnectors([]));
  }, [open, isProd]);
  const submit = async () => {
    if (!f.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/integrations`, f);
      toast.success("Integration added");
      setOpen(false);
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full h-8" data-testid="add-integration-btn"><Plus className="w-3.5 h-3.5 mr-1.5" /> Add system</Button>
      </DialogTrigger>
      <DialogContent data-testid="add-integration-dialog">
        <DialogHeader><DialogTitle className="font-display">Connect a business system</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Display name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Hotel PMS" className="mt-1.5" data-testid="ai-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-sm">Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger className="mt-1.5" data-testid="ai-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pms">PMS</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="calendar">Calendar</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm">Mode</Label>
              <Select value={f.mode} onValueChange={(v) => setF({ ...f, mode: v })}>
                <SelectTrigger className="mt-1.5" data-testid="ai-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!isProd && <SelectItem value="mock">Mock (demo)</SelectItem>}
                  <SelectItem value="live">Live (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-sm">Connector</Label>
            <Select value={f.connector_key} onValueChange={(v) => setF({ ...f, connector_key: v })}>
              <SelectTrigger className="mt-1.5" data-testid="ai-connector"><SelectValue /></SelectTrigger>
              <SelectContent>
                {connectors.filter((c) => !isProd || c.kind !== "demo").map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-orbit-text/40">
            {f.connector_key === "custom"
              ? "Custom integrations start as Action Required and go Connected only once the real system is wired by ORBIT."
              : "Live mode requires a real connector. Until one is wired, live tools safely report \"not connected\" instead of returning data."}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="ai-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add system"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddToolDialog({ integrationId, onDone }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ key: "", name: "", kind: "read", enabled: true, description: "" });
  const submit = async () => {
    if (!f.key || !f.name) { toast.error("Key and name are required"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/integrations/${integrationId}/tools`, f);
      toast.success("Tool added");
      setOpen(false);
      setF({ key: "", name: "", kind: "read", enabled: true, description: "" });
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="rounded-full h-8 text-xs" data-testid="add-tool-btn"><Plus className="w-3.5 h-3.5 mr-1" /> Tool</Button>
      </DialogTrigger>
      <DialogContent data-testid="add-tool-dialog">
        <DialogHeader><DialogTitle className="font-display">Add a tool</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-sm">Key</Label>
              <Input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="check_availability" className="mt-1.5 font-mono text-sm" data-testid="at-key" /></div>
            <div><Label className="text-sm">Kind</Label>
              <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
                <SelectTrigger className="mt-1.5" data-testid="at-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="action">Action</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-sm">Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Check room availability" className="mt-1.5" data-testid="at-name" /></div>
          <p className="text-xs text-orbit-text/40">Action tools always require explicit confirmation before they run.</p>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="at-submit" className="rounded-full bg-orbit-text hover:bg-orbit-text/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add tool"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TenantDetailSheet({ tenantId, open, onOpenChange, onChanged }) {
  const [d, setD] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const load = useCallback(() => {
    if (!tenantId) return;
    setD(null);
    setLoadError(null);
    api.get(`/admin/tenants/${tenantId}`)
      .then((r) => setD(r.data))
      // This used to swallow the failure and leave the sheet spinning forever.
      .catch((e) => setLoadError(formatApiErrorDetail(e?.response?.data?.detail)));
  }, [tenantId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const refresh = () => { load(); onChanged && onChanged(); };

  const deleteTenant = async () => {
    setDeleting(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/delete`);
      toast.success("Tenant deleted — recoverable for 30 days");
      setDeleteOpen(false);
      setDeleteConfirmText("");
      refresh();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setDeleting(false);
    }
  };

  const restoreTenant = async () => {
    setDeleting(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/restore`);
      toast.success("Tenant restored");
      refresh();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setDeleting(false);
    }
  };

  const setLifecycle = async (aeId, to) => {
    try { await api.patch(`/admin/ai-employees/${aeId}/lifecycle`, { to_state: to }); toast.success(`Moved to ${to}`); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const setStatus = async (status) => {
    try { await api.patch(`/admin/tenants/${tenantId}/status`, { status }); toast.success("Status updated"); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const patchIntegration = async (id, patch) => {
    try { await api.patch(`/admin/integrations/${id}`, patch); toast.success("Integration updated"); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const toggleTool = async (tool) => {
    try { await api.patch(`/admin/tools/${tool.id}`, { enabled: !tool.enabled }); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="tenant-detail-sheet">
        {loadError ? (
          <LoadError error={loadError} onRetry={load} className="mt-10" />
        ) : !d ? (
          <div className="py-20 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="font-display flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-semibold" style={{ backgroundColor: d.branding?.brand_color || "#18181B" }}>{(d.name || "?").charAt(0)}</span>
                {d.name}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-5 flex items-center gap-2">
              <StatusBadge kind="tenant" value={d.status} />
              <Select value={d.status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-40 ml-auto" data-testid="tenant-status-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Onboarding & Go-Live Readiness Overview */}
            {d.readiness && (
              <div className="mt-6 rounded-[22px] border border-black/5 bg-orbit-sand/80 p-4 space-y-3" data-testid="admin-readiness-panel">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-orbit-text/85 uppercase tracking-wider">
                    Onboarding Stage: <span className="text-orbit-text font-bold capitalize">{d.readiness.onboarding_stage?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {d.readiness.operational_state && (
                      <span className="text-[11px] font-semibold rounded-full px-2.5 py-0.5 bg-orbit-text/[0.06] text-orbit-text/75 capitalize" data-testid="operational-state">
                        {(d.readiness.operational_state || "").replace(/_/g, " ")}
                      </span>
                    )}
                    <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${
                      d.readiness.ready_for_live
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {d.readiness.ready_for_live ? "Ready for Live" : `${d.readiness.blockers?.length || 0} Blockers`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-orbit-text/55">Channels in this customer&apos;s plan</div>
                  <Select value={d.readiness.channel_plan || "phone_and_whatsapp"} onValueChange={async (channel_plan) => {
                    try {
                      await api.patch(`/admin/tenants/${tenantId}/channel-plan`, { channel_plan });
                      toast.success("Channel plan updated");
                      refresh();
                    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
                  }}>
                    <SelectTrigger className="h-8 w-48" data-testid="channel-plan-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone only</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp only</SelectItem>
                      <SelectItem value="phone_and_whatsapp">Phone + WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-orbit-text/55">Business type</div>
                  <Select value={d.business_type || "hotel"} onValueChange={async (business_type) => {
                    try {
                      await api.patch(`/admin/tenants/${tenantId}/business-type`, { business_type });
                      toast.success("Business type updated");
                      refresh();
                    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
                  }}>
                    <SelectTrigger className="h-8 w-48" data-testid="admin-business-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="salon">Salon</SelectItem>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-orbit-text/55">
                  Data Source: <span className="font-medium text-orbit-text/85">{d.readiness.data_source_label}</span>
                </div>

                {d.readiness.blockers?.length > 0 ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1">
                    <div className="text-[11px] font-semibold text-amber-900">Go-Live Blockers:</div>
                    <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                      {(d.readiness.blockers || []).map((b) => (
                        <li key={b} className="leading-snug">{b}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-800">All go-live requirements satisfied.</span>
                    {d.status !== "live" && (
                      <Button size="sm" className="h-7 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs px-3" onClick={() => setStatus("live")} data-testid="activate-live-btn">
                        Go Live Now
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* AI employees */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">AI Employees</h3>
                <AttachAgentDialog tenantId={tenantId} onDone={refresh} />
              </div>
              <div className="space-y-2">
                {(d.ai_employees || []).length === 0 && <p className="text-sm text-orbit-text/40">No AI employees yet.</p>}
                {(d.ai_employees || []).map((ae) => (
                  <div key={ae.id} className="rounded-xl border border-black/5 p-4" data-testid="admin-ae-row">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{ae.name} <span className="text-orbit-text/40 font-normal">· {ae.role_title}</span></div>
                        <div className="text-xs text-orbit-text/40 font-mono mt-0.5">{ae.provider_agent_id}</div>
                      </div>
                      <StatusBadge kind="lifecycle" value={ae.lifecycle_state} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {(NEXT_STATE[ae.lifecycle_state] || []).map((to) => (
                        <Button key={to} size="sm" variant="outline" className="h-7 rounded-full text-xs"
                          onClick={() => setLifecycle(ae.id, to)} data-testid={`lifecycle-${to}`}>{ACTION_LABEL[to] || to}</Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Channels */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">Channels</h3>
                <ConnectChannelDialog tenantId={tenantId} aiEmployees={d.ai_employees} onDone={refresh} />
              </div>
              <div className="space-y-2">
                {(d.channels || []).length === 0 && <p className="text-sm text-orbit-text/40">No channels connected.</p>}
                {(d.channels || []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-black/5 p-4 flex items-center justify-between" data-testid="admin-channel-row">
                    <div className="text-sm">
                      <span className="font-medium capitalize">{c.type}</span>
                      <span className="text-orbit-text/40"> · {c.connected_identifier}</span>
                    </div>
                    <StatusBadge kind="channel" value={c.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Business Integrations */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">Business Integrations</h3>
                <AddIntegrationDialog tenantId={tenantId} environment={d.environment} onDone={refresh} />
              </div>
              <div className="space-y-3">
                {(d.integrations || []).length === 0 && <p className="text-sm text-orbit-text/40">No business systems connected.</p>}
                {(d.integrations || []).map((integ) => (
                  <div key={integ.id} className="rounded-xl border border-black/5 p-4" data-testid="admin-integration-row">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">{integ.name}</span>
                        <span className="text-orbit-text/40"> · {integ.type}</span>
                        {integ.mode === "mock" && <span className="ml-2 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">MOCK</span>}
                      </div>
                      <StatusBadge kind="channel" value={integ.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Select value={integ.status} onValueChange={(v) => patchIntegration(integ.id, { status: v })}>
                        <SelectTrigger className="h-8 w-40" data-testid="integration-status-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="connected">Connected</SelectItem>
                          <SelectItem value="action_required">Action Required</SelectItem>
                          <SelectItem value="not_connected">Not Connected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={integ.mode} onValueChange={(v) => patchIntegration(integ.id, { mode: v })}>
                        <SelectTrigger className="h-8 w-28" data-testid="integration-mode-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mock">Mock</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                        </SelectContent>
                      </Select>
                      <AddToolDialog integrationId={integ.id} onDone={refresh} />
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {(d.tools || []).filter((t) => t.integration_id === integ.id).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-orbit-sand px-3 py-2" data-testid="admin-tool-row">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 ${t.kind === "action" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{t.kind === "action" ? "ACTION" : "READ"}</span>
                            <span className="truncate">{t.name}</span>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 rounded-full text-xs shrink-0" onClick={() => toggleTool(t)} data-testid={`toggle-tool-${t.key}`}>
                            {t.enabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users */}
            <div className="mt-8">
              <h3 className="font-display font-semibold mb-3">Users</h3>
              <div className="space-y-2">
                {(d.users || []).map((u) => (
                  <div key={u.id} className="rounded-xl border border-black/5 p-3 flex items-center justify-between text-sm">
                    <span>{u.name} <span className="text-orbit-text/40">· {u.email}</span></span>
                    <span className="text-xs rounded-full bg-orbit-text/[0.06] px-2 py-0.5 capitalize">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <ProductionPanel tenantId={tenantId} environment={d.environment} aiEmployees={d.ai_employees} onChanged={refresh} />

            {/* Danger zone */}
            <div className="mt-8 rounded-[22px] border border-red-200 bg-red-50/50 p-5 space-y-3" data-testid="admin-danger-zone">
              <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> Danger zone
              </div>
              {d.deleted_at ? (
                <>
                  <p className="text-sm text-orbit-text/75">
                    Deleted on {new Date(d.deleted_at).toLocaleDateString("en-IN")} — will be permanently erased on{" "}
                    {new Date(d.purge_at).toLocaleDateString("en-IN")}.
                  </p>
                  <Button variant="outline" size="sm" onClick={restoreTenant} disabled={deleting} data-testid="restore-tenant-btn" className="rounded-full">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Restore tenant"}
                  </Button>
                </>
              ) : (
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm" data-testid="delete-tenant-btn" className="rounded-full">
                      Delete tenant
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="delete-tenant-dialog">
                    <DialogHeader><DialogTitle className="font-display">Delete {d.name}?</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                      <p className="text-sm text-orbit-text/65 leading-relaxed">
                        Blocks new sign-ins right away (an already-open session may continue briefly) and
                        permanently erases all this tenant's data in 30 days, unless restored before then.
                      </p>
                      <div>
                        <Label className="text-sm">Type the tenant name ({d.name}) to confirm</Label>
                        <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
                          className="mt-1.5" data-testid="delete-tenant-confirm-input" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={deleteTenant} disabled={deleting || deleteConfirmText !== d.name} variant="destructive"
                        data-testid="delete-tenant-confirm-submit" className="rounded-full">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete tenant"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TenantsTab({ reloadStats }) {
  const [tenants, setTenants] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api.get("/admin/tenants")
      .then((r) => setTenants(r.data))
      .catch((e) => {
        setTenants([]);
        setError(formatApiErrorDetail(e?.response?.data?.detail));
      });
  }, []);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); reloadStats(); };

  return (
    <div className="space-y-5" data-testid="admin-tenants-tab">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Tenants</h2>
        <CreateTenantDialog onCreated={changed} />
      </div>
      {!tenants && !error && <Loading />}
      {error && <LoadError error={error} onRetry={load} />}
      <div className="grid md:grid-cols-2 gap-3">
        {tenants?.map((t) => (
          <button key={t.id} onClick={() => setSelected(t.id)} data-testid="admin-tenant-card"
            className="text-left rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5 hover:border-black/15 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-semibold" style={{ backgroundColor: t.branding?.brand_color || "#18181B" }}>{(t.name || "?").charAt(0)}</span>
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge kind="tenant" value={t.status} />
                    <span className="text-[10px] rounded-full bg-orbit-text/[0.06] px-2 py-0.5 text-orbit-text/65 font-medium capitalize">
                      {t.stage_label || t.onboarding_stage?.replace(/_/g, " ") || "Setup"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-orbit-text/40 capitalize flex items-center gap-2">
                    <span>{t.environment || "demo"}</span>
                    <span>·</span>
                    <span className={t.ready_for_live ? "text-emerald-600 font-medium" : "text-amber-600"}>
                      {t.ready_for_live ? "Ready for live" : `${t.blockers_count || 0} blockers`}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-orbit-text/25" />
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-orbit-text/55">
              <span className="flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> {t.counts?.ai_employees ?? 0}</span>
              <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5" /> {t.counts?.channels ?? 0}</span>
              <span className="flex items-center gap-1"><MessagesSquare className="w-3.5 h-3.5" /> {t.counts?.conversations ?? 0}</span>
            </div>
          </button>
        ))}
      </div>
      <TenantDetailSheet tenantId={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} onChanged={changed} />
    </div>
  );
}

function QueueTab() {
  const [items, setItems] = useState(null);
  const [notes, setNotes] = useState({});
  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    return api.get("/admin/customization-requests")
      .then((r) => setItems(r.data))
      .catch((e) => { setItems([]); setError(formatApiErrorDetail(e?.response?.data?.detail)); });
  };
  useEffect(() => { load(); }, []);
  const update = async (id, status, admin_notes) => {
    try { await api.patch(`/admin/customization-requests/${id}`, { status, admin_notes }); toast.success("Request updated"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div className="space-y-4" data-testid="admin-queue-tab">
      <h2 className="font-display text-lg font-semibold">Customization queue</h2>
      {!items && !error && <Loading />}
      {error && <LoadError error={error} onRetry={load} />}
      {!error && items && items.length === 0 && <p className="text-sm text-orbit-text/55">No requests.</p>}
      {items?.map((r) => (
        <div key={r.id} className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] p-5" data-testid="admin-request-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-orbit-text/40">{r.tenant_name} · {r.category}</div>
              <div className="mt-1 text-sm font-semibold">{r.title}</div>
              <p className="mt-1 text-sm text-orbit-text/55">{r.details}</p>
            </div>
            <StatusBadge kind="request" value={r.status} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={r.status} onValueChange={(v) => update(r.id, v, notes[r.id] ?? r.admin_notes)}>
              <SelectTrigger className="h-9 w-44" data-testid="request-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>{REQUEST_STATES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Note to customer…" defaultValue={r.admin_notes}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} className="h-9 flex-1 min-w-[180px]" data-testid="request-note" />
            <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={() => update(r.id, r.status, notes[r.id] ?? r.admin_notes)} data-testid="request-save-note">Save note</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DeletionQueueTab() {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState(null);
  const load = () => {
    setError(null);
    return api.get("/admin/deletion-requests")
      .then((r) => setItems(r.data))
      .catch((e) => { setItems([]); setError(formatApiErrorDetail(e?.response?.data?.detail)); });
  };
  useEffect(() => { load(); }, []);
  const resolve = async (id, action) => {
    setBusyId(id);
    try {
      await api.post(`/admin/deletion-requests/${id}/${action}`);
      toast.success(action === "approve" ? "Tenant deleted — recoverable for 30 days" : "Request rejected");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };
  const runPurge = async () => {
    setPurging(true);
    try {
      const r = await api.post("/admin/purge-expired-deletions");
      toast.success(r.data.purged_count ? `Permanently erased ${r.data.purged_count} tenant(s)` : "Nothing past its 30-day window yet");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setPurging(false);
    }
  };
  return (
    <div className="space-y-4" data-testid="admin-deletion-queue-tab">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-semibold">Deletion requests</h2>
        <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={runPurge} disabled={purging} data-testid="run-purge-btn">
          {purging ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run purge now"}
        </Button>
      </div>
      <p className="text-xs text-orbit-text/40 -mt-2">
        "Run purge now" permanently erases any tenant already past its 30-day soft-delete window — approving a
        request above only starts that window.
      </p>
      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>}
      {error && <LoadError error={error} onRetry={load} />}
      {!error && items && items.length === 0 && <p className="text-sm text-orbit-text/55">No pending deletion requests.</p>}
      {items?.map((r) => (
        <div key={r.id} className="rounded-[22px] border border-red-200 bg-red-50/40 p-5" data-testid="admin-deletion-request-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-orbit-text/40">{r.tenant_name} · requested by {r.requested_by_email}</div>
              <p className="mt-1 text-sm text-orbit-text/75">{r.reason || "No reason given."}</p>
              <div className="mt-1 text-xs text-orbit-text/40">{new Date(r.created_at).toLocaleDateString("en-IN")}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" variant="destructive" className="h-9 rounded-full" disabled={busyId === r.id}
              onClick={() => resolve(r.id, "approve")} data-testid="approve-deletion-request">
              {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve & delete"}
            </Button>
            <Button size="sm" variant="outline" className="h-9 rounded-full" disabled={busyId === r.id}
              onClick={() => resolve(r.id, "reject")} data-testid="reject-deletion-request">
              Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuarantineTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api.get("/admin/quarantine")
      .then((r) => setItems(r.data))
      .catch((e) => { setItems([]); setError(formatApiErrorDetail(e?.response?.data?.detail)); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4" data-testid="admin-quarantine-tab">
      <h2 className="font-display text-lg font-semibold">Webhook quarantine</h2>
      <p className="text-sm text-orbit-text/55">Post-call events whose <span className="font-mono">agent_id</span> maps to no AI employee are rejected and held here.</p>
      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>}
      {error && <LoadError error={error} onRetry={load} />}
      {!error && items && items.length === 0 && <p className="text-sm text-orbit-text/55">Nothing quarantined — all webhooks resolved to a tenant.</p>}
      {items?.map((q) => (
        <div key={q.id} className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm" data-testid="quarantine-row">
          <div className="font-mono text-red-700">{q.agent_id}</div>
          <div className="text-xs text-red-600/70 mt-1">{q.reason} · {q.conversation_id}</div>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS = {
  live: "bg-emerald-50 text-emerald-700", connected: "bg-emerald-50 text-emerald-700", ok: "bg-emerald-50 text-emerald-700", paid: "bg-emerald-50 text-emerald-700",
  verified: "bg-emerald-50 text-emerald-700", ready: "bg-emerald-50 text-emerald-700",
  configured: "bg-blue-50 text-blue-700", integrating: "bg-blue-50 text-blue-700", issued: "bg-blue-50 text-blue-700",
  testing: "bg-amber-50 text-amber-700", action_required: "bg-amber-50 text-amber-700", warning: "bg-amber-50 text-amber-700", credentials_required: "bg-amber-50 text-amber-700", due: "bg-amber-50 text-amber-700", payment_config_required: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700", ready_for_test: "bg-blue-50 text-blue-700", blocked: "bg-amber-50 text-amber-700", onboarding: "bg-amber-50 text-amber-700",
  not_connected: "bg-orbit-text/[0.06] text-orbit-text/55", draft: "bg-orbit-text/[0.06] text-orbit-text/55", demo: "bg-orbit-text/[0.06] text-orbit-text/55",
  not_configured: "bg-orbit-text/[0.06] text-orbit-text/55", not_included: "bg-orbit-text/[0.06] text-orbit-text/55",
  suspended: "bg-red-50 text-red-700", error: "bg-red-50 text-red-700", capped: "bg-red-50 text-red-700", failed: "bg-red-50 text-red-700",
};
const Pill = ({ v, label }) => (
  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STATUS_COLORS[v] || "bg-orbit-text/[0.06] text-orbit-text/55"}`}>
    {label || (v === "credentials_required" ? "Credentials required" : (v || "").replace(/_/g, " "))}
  </span>
);

function HealthTab() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api.get("/admin/system-health")
      .then((r) => setHealth(r.data))
      .catch((e) => setError(formatApiErrorDetail(e?.response?.data?.detail)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = health?.items;
  const cap = health?.capacity;

  return (
    <div className="space-y-6" data-testid="admin-health-tab">
      <div>
        <h2 className="font-display text-lg font-semibold">System health</h2>
        <p className="text-sm text-orbit-text/55">Platform status. Unconfigured providers show credentials required — never a fake healthy state.</p>
      </div>

      {/* Service health grid */}
      {!health && !error && <Loading />}
      {error && <LoadError error={error} onRetry={load} />}
      <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] divide-y divide-black/5">
        {items?.map((it) => (
          <div key={it.key} className="px-5 py-4 flex items-center justify-between gap-4" data-testid={`health-${it.key}`}>
            <div>
              <div className="text-sm font-medium">{it.label}</div>
              {it.detail && <div className="text-xs text-orbit-text/40 mt-0.5">{it.detail}</div>}
            </div>
            <Pill v={it.status} />
          </div>
        ))}
      </div>

      {/* Capacity / Concurrency panel */}
      {cap && (
        <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 space-y-3" data-testid="health-capacity">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-900">Concurrent call capacity</div>
              <div className="text-xs text-amber-700 mt-0.5">{cap.message}</div>
            </div>
            <Pill v={cap.status} label="Unconfirmed" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
              <div className="text-xl font-semibold text-orbit-text">{cap.active_calls ?? "—"}</div>
              <div className="text-xs text-orbit-text/40 mt-0.5">Active calls</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
              <div className="text-xl font-semibold text-orbit-text">{cap.configured_limit ?? "—"}</div>
              <div className="text-xs text-orbit-text/40 mt-0.5">Plan limit</div>
            </div>
            <div className="bg-white rounded-xl p-3 text-center border border-amber-100">
              <div className="text-xl font-semibold text-orbit-text">{cap.utilization_pct != null ? `${cap.utilization_pct}%` : "—"}</div>
              <div className="text-xs text-orbit-text/40 mt-0.5">Utilization</div>
            </div>
          </div>
          <p className="text-xs text-amber-600">
            ⚠ Do not promise a concurrency level to customers until the ElevenLabs commercial plan is confirmed and capacity is verified.
          </p>
        </div>
      )}
    </div>
  );
}


function AuditTab() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api.get("/admin/audit-log")
      .then((r) => setItems(r.data))
      .catch((e) => { setItems([]); setError(formatApiErrorDetail(e?.response?.data?.detail)); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4" data-testid="admin-audit-tab">
      <h2 className="font-display text-lg font-semibold">Audit log</h2>
      <p className="text-sm text-orbit-text/55">Admin actions: tenant, agent, channel, billing and customization changes.</p>
      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-orbit-text/25" /></div>}
      {error && <LoadError error={error} onRetry={load} />}
      {!error && items && items.length === 0 && <p className="text-sm text-orbit-text/55">No audit entries yet.</p>}
      <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] divide-y divide-black/5">
        {items?.map((a) => (
          <div key={a.id} className="px-5 py-3 text-sm" data-testid="audit-row">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{a.action}</span>
              <span className="text-xs text-orbit-text/40 shrink-0">{a.created_at ? new Date(a.created_at).toLocaleString("en-IN") : ""}</span>
            </div>
            <div className="text-xs text-orbit-text/55 mt-0.5 truncate">{a.actor_email || "system"}{a.target ? ` · ${a.target}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    return api.get("/admin/operations")
      .then((r) => setRows(r.data))
      .catch((e) => { setRows([]); setError(formatApiErrorDetail(e?.response?.data?.detail)); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-4" data-testid="admin-operations-tab">
      <h2 className="font-display text-lg font-semibold">Operations</h2>
      {!rows && !error && <Loading />}
      {error && <LoadError error={error} onRetry={load} />}
      {!error && rows && (
        <div className="rounded-[22px] border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(11,11,15,0.04),0_8px_28px_-18px_rgba(11,11,15,0.18)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-orbit-text/40 border-b border-black/5">
              <th className="px-4 py-3">Tenant</th><th className="px-3 py-3">Env</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">State</th><th className="px-3 py-3">AI</th>
              <th className="px-3 py-3">Phone</th><th className="px-3 py-3">WhatsApp</th><th className="px-3 py-3">Business</th><th className="px-3 py-3">Billing</th>
              <th className="px-3 py-3">Go-live</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tenant_id} className="border-b border-black/5 last:border-0" data-testid="ops-row">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-3 py-3"><Pill v={r.environment} /></td>
                  <td className="px-3 py-3"><Pill v={r.channel_plan} /></td>
                  <td className="px-3 py-3"><Pill v={r.operational_state} /></td>
                  <td className="px-3 py-3"><Pill v={r.ai_employee} /></td>
                  <td className="px-3 py-3"><Pill v={r.phone} /></td>
                  <td className="px-3 py-3"><Pill v={r.whatsapp} /></td>
                  <td className="px-3 py-3"><Pill v={r.business_integration} /></td>
                  <td className="px-3 py-3"><Pill v={r.billing} /></td>
                  <td className="px-3 py-3">
                    <Pill v={r.is_live ? "live" : (r.ready_for_live ? "ok" : "action_required")}
                      label={r.is_live ? "Live" : (r.ready_for_live ? "Ready" : `${(r.blockers || []).length} pending`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProductionPanel({ tenantId, environment, aiEmployees, onChanged }) {
  const [prov, setProv] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [kb, setKb] = useState({});
  const ae0 = aiEmployees?.[0];

  const load = useCallback(() => {
    api.get(`/admin/tenants/${tenantId}/readiness`).then((r) => setReadiness(r.data)).catch(() => {});
    api.get(`/admin/tenants/${tenantId}/provisioning`).then((r) => setProv(r.data)).catch(() => {});
    api.get(`/admin/tenants/${tenantId}/pricing`).then((r) => setPricing(r.data)).catch(() => {});
    api.get(`/admin/tenants/${tenantId}/invoices`).then((r) => setInvoices(r.data)).catch(() => {});
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (ae0) setKb(ae0.knowledge_base || {}); }, [ae0]);

  const wrap = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); load(); onChanged && onChanged(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const setEnv = (env) => wrap(() => api.patch(`/admin/tenants/${tenantId}/environment`, { environment: env }), `Environment set to ${env}`);
  const savePricing = () => wrap(() => api.put(`/admin/tenants/${tenantId}/pricing`, pricing), "Pricing saved");
  const genInvoice = () => wrap(() => api.post(`/admin/tenants/${tenantId}/invoices/generate`, {}), "Invoice generated");
  const issueInv = (id) => wrap(() => api.post(`/admin/invoices/${id}/issue`), "Invoice issued");
  const verifyVoice = (aeId) => wrap(async () => { const r = await api.post(`/admin/ai-employees/${aeId}/verify-voice`); toast.message(r.data.message); });
  const verifyTel = (chId) => wrap(async () => { const r = await api.post(`/admin/channels/${chId}/verify-telephony`); toast.message(r.data.message); });
  const verifyWa = (chId) => wrap(async () => { const r = await api.post(`/admin/channels/${chId}/verify-whatsapp`); toast.message(r.data.message); });
  const saveKb = () => wrap(() => api.patch(`/admin/ai-employees/${ae0.id}/knowledge`, kb), "Knowledge base saved");

  const num = (k) => (
    <div>
      <Label className="text-[11px] text-orbit-text/55">{k.replace(/_/g, " ")}</Label>
      {/* Clearing the box used to produce NaN, which JSON-serialises to null,
          which the backend drops — so "Saved" appeared and the old price stayed.
          An empty box now means "no value", and a number means the number. */}
      <Input
        type="number"
        value={pricing?.[k] ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = raw === "" ? "" : parseFloat(raw);
          setPricing({ ...pricing, [k]: Number.isNaN(parsed) ? "" : parsed });
        }}
        className="mt-1 h-8"
        data-testid={`price-${k}`}
      />
    </div>
  );

  return (
    <div className="mt-8 space-y-6" data-testid="production-panel">
      <h3 className="font-display font-semibold">Production readiness</h3>

      {readiness && (
        <div className="rounded-xl border border-black/5 p-4" data-testid="readiness-checklist">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Go-live checklist</div>
            <div className="flex items-center gap-1.5">
              {readiness.operational_state && <Pill v={readiness.operational_state} />}
              <Pill v={readiness.is_live ? "live" : (readiness.ready_for_live ? "ok" : "action_required")}
                label={readiness.is_live ? "Live" : (readiness.ready_for_live ? "Ready for live" : `${(readiness.blockers || []).length} pending`)} />
            </div>
          </div>
          <div className="space-y-1.5">
            {(readiness.items || []).map((it) => (
              <div key={it.key} className="flex items-center justify-between gap-3 text-sm" data-testid={`readiness-${it.key}`}>
                <span className="text-orbit-text/65 min-w-0 truncate">
                  {it.label}
                  {!it.required && <span className="ml-1.5 text-[10px] text-orbit-text/40">optional</span>}
                  {it.detail && <span className="ml-2 text-xs text-orbit-text/40">{it.detail}</span>}
                </span>
                <Pill v={it.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-black/5 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Environment</div>
          <div className="flex gap-1.5">
            {["demo", "production"].map((e) => (
              <Button key={e} size="sm" variant={environment === e ? "default" : "outline"}
                className={`h-7 rounded-full text-xs capitalize ${environment === e ? "bg-orbit-text" : ""}`}
                onClick={() => setEnv(e)} data-testid={`env-${e}`}>{e}</Button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-orbit-text/40">Production tenants never use mock data or simulated calls.</p>
      </div>

      {prov && (
        <div className="rounded-xl border border-black/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium"><KeyRound className="w-4 h-4" /> Provider connections</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-orbit-text/65">ElevenLabs webhooks</span>
            <Pill v={prov.elevenlabs?.webhooks_configured ? "verified" : "credentials_required"} />
          </div>
          {(prov.elevenlabs?.agents || []).map((a) => (
            <div key={a.ai_employee_id} className="flex items-center justify-between text-sm" data-testid="prov-voice">
              <span className="text-orbit-text/65">Voice · {a.name}</span>
              <div className="flex items-center gap-2"><Pill v={a.status} /><Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => verifyVoice(a.ai_employee_id)}>Verify</Button></div>
            </div>
          ))}
          {(prov.exotel?.numbers || []).map((n) => (
            <div key={n.channel_id} className="flex items-center justify-between text-sm" data-testid="prov-tel">
              <span className="text-orbit-text/65">Telephony · {n.number}</span>
              <div className="flex items-center gap-2"><Pill v={n.status} /><Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => verifyTel(n.channel_id)}>Verify</Button></div>
            </div>
          ))}
          {(prov.whatsapp?.numbers || []).map((n) => (
            <div key={n.channel_id} className="flex items-center justify-between text-sm" data-testid="prov-wa">
              <span className="text-orbit-text/65">WhatsApp · {n.number}</span>
              <div className="flex items-center gap-2"><Pill v={n.status} /><Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => verifyWa(n.channel_id)}>Verify</Button></div>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm">
            <span className="text-orbit-text/65">Payments · Razorpay</span>
            <Pill v={prov.razorpay?.credentials_configured ? "configured" : "credentials_required"} />
          </div>
        </div>
      )}

      {pricing && (
        <div className="rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3"><Receipt className="w-4 h-4" /> Pricing (INR)</div>
          <div className="grid grid-cols-3 gap-2">
            {num("ai_voice_per_min")}{num("telephony_per_min")}{num("whatsapp_per_message")}
            {num("service_charge")}{num("gst_pct")}{num("orbit_markup_pct")}
            {num("warning_threshold")}{num("hard_cap")}
          </div>
          <Button size="sm" className="mt-3 rounded-full h-8 bg-orbit-text hover:bg-orbit-text/90" onClick={savePricing} data-testid="save-pricing">Save pricing</Button>
        </div>
      )}

      <div className="rounded-xl border border-black/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Invoices</div>
          <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={genInvoice} data-testid="gen-invoice"><Plus className="w-3.5 h-3.5 mr-1" /> Generate</Button>
        </div>
        <div className="space-y-1.5">
          {(invoices || []).length === 0 && <p className="text-xs text-orbit-text/40">No invoices.</p>}
          {(invoices || []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg bg-orbit-sand px-3 py-2 text-sm" data-testid="admin-invoice-row">
              <span>{inv.period} · ₹{inv.total}</span>
              <div className="flex items-center gap-2">
                <Pill v={inv.status} />
                {inv.status === "draft" && <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => issueInv(inv.id)} data-testid="issue-invoice">Issue</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ae0 && (
        <div className="rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium mb-3"><BookOpen className="w-4 h-4" /> Knowledge base · {ae0.name} (static)</div>
          <div className="space-y-2">
            {["business_info", "services", "policies", "hours", "instructions"].map((f) => (
              <div key={f}>
                <Label className="text-[11px] text-orbit-text/55 capitalize">{f.replace(/_/g, " ")}</Label>
                <Textarea value={kb?.[f] || ""} onChange={(e) => setKb({ ...kb, [f]: e.target.value })} rows={2} className="mt-1 text-sm" data-testid={`kb-${f}`} />
              </div>
            ))}
          </div>
          <Button size="sm" className="mt-3 rounded-full h-8 bg-orbit-text hover:bg-orbit-text/90" onClick={saveKb} data-testid="save-kb">Save knowledge</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminConsole() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const loadStats = useCallback(() => api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {}), []);
  useEffect(() => { loadStats(); }, [loadStats]);

  const doLogout = async () => { await logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen bg-orbit-sand" data-testid="admin-console">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-black/5 bg-white/80 px-6 backdrop-blur-xl lg:px-8">
        <div className="flex items-center gap-2.5">
          <OrbitLogo className="h-[26px] w-[26px] text-orbit-text" title="ORBIT" />
          <span className="font-display text-[19px] font-bold tracking-[-0.04em]">ORBIT</span>
          <span className="ml-2 text-xs rounded-full bg-orbit-text text-white px-2.5 py-1">Platform Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-orbit-text/55 hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={doLogout} data-testid="admin-logout" className="text-red-600 hover:text-red-600 rounded-full"><LogOut className="w-4 h-4 mr-1.5" /> Sign out</Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8 p-6 lg:p-10">
        <PageHeader
          eyebrow="Platform admin"
          title="Platform control"
          subtitle="Tenants, AI employees, channels and the managed-service queue."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatPill icon={Building2} label="Tenants" value={stats?.tenants ?? "—"} testid="admin-stat-tenants" />
          <StatPill icon={Building2} label="Live" value={stats?.live_tenants ?? "—"} testid="admin-stat-live" />
          <StatPill icon={Bot} label="AI employees" value={stats?.ai_employees ?? "—"} testid="admin-stat-ai" />
          <StatPill icon={Bot} label="Live agents" value={stats?.live_ai_employees ?? "—"} />
          <StatPill icon={MessagesSquare} label="Conversations" value={stats?.conversations ?? "—"} />
          <StatPill icon={Wand2} label="Open requests" value={stats?.open_requests ?? "—"} />
          <StatPill icon={ShieldAlert} label="Quarantined" value={stats?.quarantined_webhooks ?? "—"} />
        </div>

        <Tabs defaultValue="tenants">
          <TabsList className="rounded-full">
            <TabsTrigger value="tenants" className="rounded-full" data-testid="tab-tenants">Tenants</TabsTrigger>
            <TabsTrigger value="queue" className="rounded-full" data-testid="tab-queue">Customization queue</TabsTrigger>
            <TabsTrigger value="deletions" className="rounded-full" data-testid="tab-deletions">Deletion requests</TabsTrigger>
            <TabsTrigger value="quarantine" className="rounded-full" data-testid="tab-quarantine">Quarantine</TabsTrigger>
            <TabsTrigger value="operations" className="rounded-full" data-testid="tab-operations">Operations</TabsTrigger>
            <TabsTrigger value="health" className="rounded-full" data-testid="tab-health">System health</TabsTrigger>
            <TabsTrigger value="audit" className="rounded-full" data-testid="tab-audit">Audit log</TabsTrigger>
          </TabsList>
          <TabsContent value="tenants" className="mt-6"><TenantsTab reloadStats={loadStats} /></TabsContent>
          <TabsContent value="queue" className="mt-6"><QueueTab /></TabsContent>
          <TabsContent value="deletions" className="mt-6"><DeletionQueueTab /></TabsContent>
          <TabsContent value="quarantine" className="mt-6"><QuarantineTab /></TabsContent>
          <TabsContent value="operations" className="mt-6"><OperationsTab /></TabsContent>
          <TabsContent value="health" className="mt-6"><HealthTab /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
