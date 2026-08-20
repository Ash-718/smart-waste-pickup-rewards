export default function ChartTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-md">
      {label != null && <div className="text-xs font-medium text-neutral-500">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color || entry.fill || entry.payload?.fill }}
          />
          <span className="font-semibold tabular-nums text-neutral-900">
            {valueFormatter ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
