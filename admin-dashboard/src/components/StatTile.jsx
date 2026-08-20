function formatCompact(value) {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

export default function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{formatCompact(value)}</div>
    </div>
  );
}
