const LIFECYCLE = {
  draft: { label: "Draft", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  testing: { label: "Testing", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  live: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200" },
};

const CHANNEL = {
  connected: { label: "Connected", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  verified: { label: "Verified", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ready: { label: "Ready", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  configured: { label: "Configured", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  setup_in_progress: { label: "Setup in progress", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  action_required: { label: "Setup in progress", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  credentials_required: { label: "Setup in progress", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  not_configured: { label: "Not configured", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  not_included: { label: "Not in plan", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  failed: { label: "Needs attention", cls: "bg-red-50 text-red-700 border-red-200" },
  disconnected: { label: "Disconnected", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  pending: { label: "Pending", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  // These four are real values the admin console can set or the backend can
  // return; without them the badge printed the raw snake_case key.
  not_connected: { label: "Not connected", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  unavailable: { label: "Unavailable", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  error: { label: "Needs attention", cls: "bg-red-50 text-red-700 border-red-200" },
  quarantined: { label: "Quarantined", cls: "bg-red-50 text-red-700 border-red-200" },
  ok: { label: "OK", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const TENANT = {
  live: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  onboarding: { label: "Onboarding", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200" },
  deleted: { label: "Deleted", cls: "bg-red-50 text-red-700 border-red-200" },
  demo: { label: "Demo", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

const REQUEST = {
  submitted: { label: "Submitted", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  in_review: { label: "In Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
};

const MAPS = { lifecycle: LIFECYCLE, channel: CHANNEL, tenant: TENANT, request: REQUEST };

// Last resort for a status nobody has mapped yet: show "Setup in progress",
// not "setup_in_progress". A database key leaking into the UI reads as a bug
// even when the underlying state is perfectly normal.
const humanise = (v) => {
  if (!v || typeof v !== "string") return "Unknown";
  const words = v.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const StatusBadge = ({ kind = "lifecycle", value, testid }) => {
  const meta = (MAPS[kind] || {})[value] || {
    label: humanise(value),
    cls: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
    >
      {(value === "live" || value === "connected" || value === "ready" || value === "verified") && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {meta.label}
    </span>
  );
};
