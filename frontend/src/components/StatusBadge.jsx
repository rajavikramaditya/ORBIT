const LIFECYCLE = {
  draft: { label: "Draft", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  testing: { label: "Testing", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Approved", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  live: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200" },
};

const CHANNEL = {
  connected: { label: "Connected", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  action_required: { label: "Action Required", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  disconnected: { label: "Disconnected", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  pending: { label: "Pending", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

const TENANT = {
  live: { label: "Live", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  onboarding: { label: "Onboarding", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200" },
};

const REQUEST = {
  submitted: { label: "Submitted", cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  in_review: { label: "In Review", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700 border-red-200" },
};

const MAPS = { lifecycle: LIFECYCLE, channel: CHANNEL, tenant: TENANT, request: REQUEST };

export const StatusBadge = ({ kind = "lifecycle", value, testid }) => {
  const meta = (MAPS[kind] || {})[value] || { label: value, cls: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
    >
      {(value === "live" || value === "connected") && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />}
      {meta.label}
    </span>
  );
};
