export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="animate-pulse divide-y divide-neutral-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-4 py-4">
            {Array.from({ length: cols }).map((__, c) => (
              <div key={c} className="h-4 flex-1 rounded bg-neutral-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-200 bg-white p-5">
      <div className="h-3 w-24 rounded bg-neutral-200" />
      <div className="mt-3 h-7 w-16 rounded bg-neutral-200" />
    </div>
  );
}
