const STYLES = {
  requested: "bg-amber-50 text-amber-700 ring-amber-600/20",
  assigned: "bg-blue-50 text-blue-700 ring-blue-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
  cancelled: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
};

const LABELS = {
  requested: "Requested",
  assigned: "Assigned",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || STYLES.requested;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
