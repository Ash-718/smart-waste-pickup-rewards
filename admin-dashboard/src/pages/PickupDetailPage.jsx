import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPickup, updatePickupStatus } from "../api/pickups";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";

const NEXT_STATUS = {
  requested: ["assigned", "cancelled"],
  assigned: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function PickupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wasteTypeLabel, quantityBandLabel, slotPeriodLabel } = useMeta();
  const [feedback, setFeedback] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickup", id],
    queryFn: () => getPickup(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => updatePickupStatus(id, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      if (result.pointsEarned) {
        setFeedback(
          `Marked completed. ${result.pointsEarned} points credited${
            result.newBadges?.length ? ` — new badge(s): ${result.newBadges.map((b) => b.name).join(", ")}` : ""
          }.`
        );
      }
    },
  });

  if (isLoading) return <CardSkeleton />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const pickup = data.pickup;
  const nextOptions = NEXT_STATUS[pickup.status] || [];

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        &larr; Back to queue
      </button>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{pickup.user?.name}</h1>
            <p className="text-sm text-neutral-500">{pickup.user?.email || pickup.user?.phone}</p>
          </div>
          <StatusBadge status={pickup.status} />
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Waste type</dt>
            <dd className="font-medium text-neutral-900">{wasteTypeLabel(pickup.wasteType)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Quantity</dt>
            <dd className="font-medium text-neutral-900">{quantityBandLabel(pickup.quantityBand)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Slot</dt>
            <dd className="font-medium text-neutral-900">
              {slotPeriodLabel(pickup.slotPeriod)} &middot;{" "}
              {new Date(pickup.requestedDate).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Assigned admin</dt>
            <dd className="font-medium text-neutral-900">{pickup.assignedAdmin?.name || "Unassigned"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-neutral-500">Address</dt>
            <dd className="font-medium text-neutral-900">{pickup.address}</dd>
          </div>
        </dl>

        {pickup.photoUrl && (
          <img
            src={pickup.photoUrl}
            alt="Pickup"
            className="mt-4 h-40 w-40 rounded-lg object-cover ring-1 ring-neutral-200"
          />
        )}

        {feedback && (
          <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{feedback}</p>
        )}
        {statusMutation.isError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {statusMutation.error.message}
          </p>
        )}

        {nextOptions.length > 0 && (
          <div className="mt-6 flex gap-2 border-t border-neutral-100 pt-4">
            {nextOptions.map((status) => (
              <button
                key={status}
                onClick={() => statusMutation.mutate(status)}
                disabled={statusMutation.isPending}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors disabled:opacity-60 ${
                  status === "completed"
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : status === "cancelled"
                    ? "border border-red-200 text-red-700 hover:bg-red-50"
                    : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Mark {status}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
