const STYLES = {
  requested: "bg-amber-50 text-amber-700 ring-amber-600/20",
  assigned: "bg-blue-50 text-blue-700 ring-blue-600/20",
  completed: "bg-brand-100 text-brand-800 ring-brand-600/20",
  cancelled: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
};

const LABELS = {
  requested: "Requested",
  assigned: "Assigned",
  completed: "Completed",
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
