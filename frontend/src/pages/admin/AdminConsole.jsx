import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Orbit, LogOut, Plus, Loader2, Building2, Bot, Radio, MessagesSquare,
  Wand2, ShieldAlert, ChevronRight, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
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
const REQUEST_STATES = ["submitted", "in_review", "in_progress", "completed", "rejected"];

function StatPill({ icon: Icon, label, value, testid }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 flex items-center gap-3" data-testid={testid}>
      <span className="w-10 h-10 rounded-xl bg-zinc-100 grid place-items-center text-zinc-700"><Icon className="w-4.5 h-4.5" strokeWidth={1.7} /></span>
      <div>
        <div className="font-display text-2xl font-semibold leading-none">{value}</div>
        <div className="mt-1 text-xs text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

function CreateTenantDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ name: "", owner_name: "", owner_email: "", owner_password: "", brand_color: "#18181B" });
  const submit = async () => {
    if (!f.name || !f.owner_email || !f.owner_password) { toast.error("Name, owner email and password are required"); return; }
    setSaving(true);
    try {
      await api.post("/admin/tenants", f);
      toast.success("Tenant created");
      setOpen(false);
      setF({ name: "", owner_name: "", owner_email: "", owner_password: "", brand_color: "#18181B" });
      onCreated();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="create-tenant-btn" className="rounded-full h-10 px-5 bg-zinc-900 hover:bg-zinc-800"><Plus className="w-4 h-4 mr-2" /> Create tenant</Button>
      </DialogTrigger>
      <DialogContent data-testid="create-tenant-dialog">
        <DialogHeader><DialogTitle className="font-display">Onboard a new hotel</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Hotel name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="The Oberoi, Delhi" className="mt-1.5" data-testid="ct-name" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-sm">Owner name</Label>
              <Input value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} placeholder="Owner name" className="mt-1.5" data-testid="ct-owner-name" /></div>
            <div><Label className="text-sm">Brand colour</Label>
              <Input value={f.brand_color} onChange={(e) => setF({ ...f, brand_color: e.target.value })} className="mt-1.5" data-testid="ct-brand" /></div>
          </div>
          <div><Label className="text-sm">Owner email</Label>
            <Input type="email" value={f.owner_email} onChange={(e) => setF({ ...f, owner_email: e.target.value })} placeholder="owner@hotel.in" className="mt-1.5" data-testid="ct-owner-email" /></div>
          <div><Label className="text-sm">Temporary password</Label>
            <Input value={f.owner_password} onChange={(e) => setF({ ...f, owner_password: e.target.value })} placeholder="min 6 characters" className="mt-1.5" data-testid="ct-owner-password" /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="ct-submit" className="rounded-full bg-zinc-900 hover:bg-zinc-800">
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
  const [f, setF] = useState({ name: "", role_title: "Front Desk Concierge", provider_agent_id: "", voice_name: "Aria", voice_description: "Warm, professional Indian English" });
  const submit = async () => {
    if (!f.name || !f.provider_agent_id) { toast.error("Name and provider_agent_id are required"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/tenants/${tenantId}/ai-employees`, f);
      toast.success("AI employee created (Draft)");
      setOpen(false);
      setF({ name: "", role_title: "Front Desk Concierge", provider_agent_id: "", voice_name: "Aria", voice_description: "Warm, professional Indian English" });
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
        <DialogHeader><DialogTitle className="font-display">Attach ElevenLabs agent</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-sm">Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Aria" className="mt-1.5" data-testid="aa-name" /></div>
          <div><Label className="text-sm">Role title</Label>
            <Input value={f.role_title} onChange={(e) => setF({ ...f, role_title: e.target.value })} className="mt-1.5" data-testid="aa-role" /></div>
          <div><Label className="text-sm">provider_agent_id (ElevenLabs)</Label>
            <Input value={f.provider_agent_id} onChange={(e) => setF({ ...f, provider_agent_id: e.target.value })} placeholder="agent_xxx" className="mt-1.5 font-mono text-sm" data-testid="aa-agent-id" /></div>
          <div><Label className="text-sm">Voice</Label>
            <Input value={f.voice_name} onChange={(e) => setF({ ...f, voice_name: e.target.value })} className="mt-1.5" data-testid="aa-voice" /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving} data-testid="aa-submit" className="rounded-full bg-zinc-900 hover:bg-zinc-800">
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
          <Button onClick={submit} disabled={saving} data-testid="cc-submit" className="rounded-full bg-zinc-900 hover:bg-zinc-800">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TenantDetailSheet({ tenantId, open, onOpenChange, onChanged }) {
  const [d, setD] = useState(null);
  const load = useCallback(() => {
    if (!tenantId) return;
    setD(null);
    api.get(`/admin/tenants/${tenantId}`).then((r) => setD(r.data)).catch(() => {});
  }, [tenantId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const refresh = () => { load(); onChanged && onChanged(); };

  const setLifecycle = async (aeId, to) => {
    try { await api.patch(`/admin/ai-employees/${aeId}/lifecycle`, { to_state: to }); toast.success(`Moved to ${to}`); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const setStatus = async (status) => {
    try { await api.patch(`/admin/tenants/${tenantId}/status`, { status }); toast.success("Status updated"); refresh(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="tenant-detail-sheet">
        {!d ? (
          <div className="py-20 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="font-display flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl grid place-items-center text-white text-sm font-semibold" style={{ backgroundColor: d.branding?.brand_color || "#18181B" }}>{d.name.charAt(0)}</span>
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

            {/* AI employees */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">AI Employees</h3>
                <AttachAgentDialog tenantId={tenantId} onDone={refresh} />
              </div>
              <div className="space-y-2">
                {d.ai_employees.length === 0 && <p className="text-sm text-zinc-400">No AI employees yet.</p>}
                {d.ai_employees.map((ae) => (
                  <div key={ae.id} className="rounded-xl border border-black/5 p-4" data-testid="admin-ae-row">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{ae.name} <span className="text-zinc-400 font-normal">· {ae.role_title}</span></div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">{ae.provider_agent_id}</div>
                      </div>
                      <StatusBadge kind="lifecycle" value={ae.lifecycle_state} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {(NEXT_STATE[ae.lifecycle_state] || []).map((to) => (
                        <Button key={to} size="sm" variant="outline" className="h-7 rounded-full text-xs capitalize"
                          onClick={() => setLifecycle(ae.id, to)} data-testid={`lifecycle-${to}`}>→ {to}</Button>
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
                {d.channels.length === 0 && <p className="text-sm text-zinc-400">No channels connected.</p>}
                {d.channels.map((c) => (
                  <div key={c.id} className="rounded-xl border border-black/5 p-4 flex items-center justify-between" data-testid="admin-channel-row">
                    <div className="text-sm">
                      <span className="font-medium capitalize">{c.type}</span>
                      <span className="text-zinc-400"> · {c.connected_identifier}</span>
                    </div>
                    <StatusBadge kind="channel" value={c.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Users */}
            <div className="mt-8">
              <h3 className="font-display font-semibold mb-3">Users</h3>
              <div className="space-y-2">
                {d.users.map((u) => (
                  <div key={u.id} className="rounded-xl border border-black/5 p-3 flex items-center justify-between text-sm">
                    <span>{u.name} <span className="text-zinc-400">· {u.email}</span></span>
                    <span className="text-xs rounded-full bg-zinc-100 px-2 py-0.5 capitalize">{u.role}</span>
                  </div>
                ))}
              </div>
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
  const load = useCallback(() => api.get("/admin/tenants").then((r) => setTenants(r.data)).catch(() => setTenants([])), []);
  useEffect(() => { load(); }, [load]);
  const changed = () => { load(); reloadStats(); };

  return (
    <div className="space-y-5" data-testid="admin-tenants-tab">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Tenants</h2>
        <CreateTenantDialog onCreated={changed} />
      </div>
      {!tenants && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
      <div className="grid md:grid-cols-2 gap-3">
        {tenants?.map((t) => (
          <button key={t.id} onClick={() => setSelected(t.id)} data-testid="admin-tenant-card"
            className="text-left rounded-2xl border border-black/5 bg-white p-5 hover:border-black/15 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl grid place-items-center text-white font-semibold" style={{ backgroundColor: t.branding?.brand_color || "#18181B" }}>{t.name.charAt(0)}</span>
                <div>
                  <div className="font-medium text-sm">{t.name}</div>
                  <div className="mt-1"><StatusBadge kind="tenant" value={t.status} /></div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> {t.counts.ai_employees}</span>
              <span className="flex items-center gap-1"><Radio className="w-3.5 h-3.5" /> {t.counts.channels}</span>
              <span className="flex items-center gap-1"><MessagesSquare className="w-3.5 h-3.5" /> {t.counts.conversations}</span>
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
  const load = () => api.get("/admin/customization-requests").then((r) => setItems(r.data)).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const update = async (id, status, admin_notes) => {
    try { await api.patch(`/admin/customization-requests/${id}`, { status, admin_notes }); toast.success("Request updated"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  return (
    <div className="space-y-4" data-testid="admin-queue-tab">
      <h2 className="font-display text-lg font-semibold">Customization queue</h2>
      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
      {items && items.length === 0 && <p className="text-sm text-zinc-500">No requests.</p>}
      {items?.map((r) => (
        <div key={r.id} className="rounded-2xl border border-black/5 bg-white p-5" data-testid="admin-request-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs text-zinc-400">{r.tenant_name} · {r.category}</div>
              <div className="mt-1 text-sm font-semibold">{r.title}</div>
              <p className="mt-1 text-sm text-zinc-500">{r.details}</p>
            </div>
            <StatusBadge kind="request" value={r.status} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Select value={r.status} onValueChange={(v) => update(r.id, v, r.admin_notes)}>
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

function QuarantineTab() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/admin/quarantine").then((r) => setItems(r.data)).catch(() => setItems([])); }, []);
  return (
    <div className="space-y-4" data-testid="admin-quarantine-tab">
      <h2 className="font-display text-lg font-semibold">Webhook quarantine</h2>
      <p className="text-sm text-zinc-500">Post-call events whose <span className="font-mono">agent_id</span> maps to no AI employee are rejected and held here.</p>
      {!items && <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-300" /></div>}
      {items && items.length === 0 && <p className="text-sm text-zinc-500">Nothing quarantined — all webhooks resolved to a tenant.</p>}
      {items?.map((q) => (
        <div key={q.id} className="rounded-xl border border-red-100 bg-red-50/50 p-4 text-sm" data-testid="quarantine-row">
          <div className="font-mono text-red-700">{q.agent_id}</div>
          <div className="text-xs text-red-600/70 mt-1">{q.reason} · {q.conversation_id}</div>
        </div>
      ))}
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
    <div className="min-h-screen bg-zinc-50" data-testid="admin-console">
      <header className="h-16 sticky top-0 z-30 glass border-b border-black/5 flex items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white grid place-items-center"><Orbit className="w-4.5 h-4.5" strokeWidth={1.6} /></div>
          <span className="font-display font-semibold">ORBIT</span>
          <span className="ml-2 text-xs rounded-full bg-zinc-900 text-white px-2.5 py-1">Platform Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={doLogout} data-testid="admin-logout" className="text-red-600 hover:text-red-600 rounded-full"><LogOut className="w-4 h-4 mr-1.5" /> Sign out</Button>
        </div>
      </header>

      <main className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Platform control</h1>
          <p className="mt-1.5 text-zinc-500 text-sm">Manage tenants, AI employees, channels and the managed-service queue.</p>
        </div>

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
            <TabsTrigger value="quarantine" className="rounded-full" data-testid="tab-quarantine">Quarantine</TabsTrigger>
          </TabsList>
          <TabsContent value="tenants" className="mt-6"><TenantsTab reloadStats={loadStats} /></TabsContent>
          <TabsContent value="queue" className="mt-6"><QueueTab /></TabsContent>
          <TabsContent value="quarantine" className="mt-6"><QuarantineTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
