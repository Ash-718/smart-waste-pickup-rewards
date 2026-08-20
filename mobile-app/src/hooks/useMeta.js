import { useQuery } from "@tanstack/react-query";
import { getMeta } from "../api/meta";

export function useMeta() {
  const { data } = useQuery({ queryKey: ["meta"], queryFn: getMeta, staleTime: Infinity });

  const wasteTypeLabel = (value) => data?.wasteTypes?.find((w) => w.value === value)?.label || value;
  const quantityBandLabel = (value) =>
    data?.quantityBands?.find((q) => q.value === value)?.label || value;
  const slotPeriodLabel = (value) => data?.slotPeriods?.find((s) => s.value === value)?.label || value;

  return { meta: data, wasteTypeLabel, quantityBandLabel, slotPeriodLabel };
}
