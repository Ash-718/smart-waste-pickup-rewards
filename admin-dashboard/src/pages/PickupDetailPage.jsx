import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPickup, updatePickupStatus } from "../api/pickups";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";
import AssignCollectorModal from "../components/AssignCollectorModal";
import RejectPickupModal from "../components/RejectPickupModal";
import UserProfileModal from "../components/UserProfileModal";

export default function PickupDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { wasteTypeLabel, quantityBandLabel, slotPeriodLabel } = useMeta();

  const [feedback, setFeedback] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [measuredWeight, setMeasuredWeight] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["pickup", id],
    queryFn: () => getPickup(id),
  });

  const completeMutation = useMutation({
    mutationFn: (payload) => updatePickupStatus(id, payload),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      setIsCompleting(false);
      setFeedback(
        `Marked completed! ${result.pointsEarned} Green Points awarded to citizen${
          result.newBadges?.length
            ? ` & unlocked badge: ${result.newBadges.map((b) => b.name).join(", ")}`
            : ""
        }.`
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => updatePickupStatus(id, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
    },
  });

  if (isLoading) return <CardSkeleton />;
  if (isError) return <ErrorState message={error.message} onRetry={refetch} />;

  const pickup = data.pickup;

  function handleCompletePickup() {
    const kg = parseFloat(measuredWeight);
    completeMutation.mutate({
      status: "completed",
      wasteQuantity: !isNaN(kg) && kg > 0 ? kg : pickup.wasteQuantity,
    });
  }

  return (
    <div className="max-w-3xl space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        &larr; Back to pickup queue
      </button>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-neutral-400">
                #{pickup.id.slice(0, 8).toUpperCase()}
              </span>
              <StatusBadge status={pickup.status} />
            </div>
            <h1 className="mt-1 text-xl font-bold text-neutral-900 flex items-center gap-2">
              {pickup.user?.name}
              <button
                onClick={() => setShowUserModal(true)}
                className="rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                View Citizen Profile →
              </button>
            </h1>
            <p className="text-xs text-neutral-500">
              {pickup.user?.email || "No email"} &middot; {pickup.user?.phone || "No phone"}
            </p>
          </div>

          {/* Quick Assign / Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {(pickup.status === "requested" || pickup.status === "assigned") && (
              <>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  {pickup.status === "assigned" ? "Reassign Collector" : "Assign Collector"}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Reject with Reason
                </button>
              </>
            )}
          </div>
        </div>

        {/* Rejection Notice Banner */}
        {pickup.status === "rejected" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
              ⚠️ Pickup Rejected
            </h3>
            <p className="mt-1 text-sm font-semibold text-rose-900">
              Reason: {pickup.rejectionReason || "No specific reason provided."}
            </p>
            <p className="mt-1 text-xs text-rose-600">
              This reason is currently visible to citizen {pickup.user?.name} in their mobile app.
            </p>
          </div>
        )}

        {/* Pickup Details Grid */}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Waste Material</dt>
            <dd className="mt-1 text-sm font-bold text-neutral-900">{wasteTypeLabel(pickup.wasteType)}</dd>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Quantity & Weight</dt>
            <dd className="mt-1 text-sm font-bold text-emerald-800">
              {quantityBandLabel(pickup.quantityBand)}
              {pickup.wasteQuantity ? ` (~${pickup.wasteQuantity} kg)` : ""}
            </dd>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Pickup Slot & Date</dt>
            <dd className="mt-1 text-sm font-bold text-neutral-900">
              {slotPeriodLabel(pickup.slotPeriod)} &middot; {new Date(pickup.requestedDate).toLocaleDateString()}
            </dd>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Assigned Collector / Staff</dt>
            <dd className="mt-1 text-sm font-bold text-blue-900">
              {pickup.assignedAdmin ? (
                <>
                  {pickup.assignedAdmin.name} ({pickup.assignedAdmin.role})
                  {pickup.assignedAt && (
                    <span className="block text-xs font-normal text-neutral-500">
                      Assigned on {new Date(pickup.assignedAt).toLocaleDateString()}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-neutral-400 font-normal italic">Not yet assigned</span>
              )}
            </dd>
          </div>

          <div className="col-span-full rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Collection Address</dt>
            <dd className="mt-1 text-sm font-medium text-neutral-900">{pickup.address}</dd>
          </div>

          {pickup.pointsLedgerEntry && (
            <div className="col-span-full rounded-xl bg-amber-50 border border-amber-200 p-3">
              <dt className="font-semibold uppercase tracking-wider text-amber-800">Green Points Credited</dt>
              <dd className="mt-1 text-base font-bold text-amber-900">
                +{pickup.pointsLedgerEntry.pointsEarned} Green Points
              </dd>
            </div>
          )}
        </dl>

        {/* Photo preview */}
        {pickup.photoUrl && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Citizen Photo Upload
            </h3>
            <img
              src={pickup.photoUrl}
              alt="Pickup item"
              className="h-56 w-full max-w-md rounded-xl object-cover ring-1 ring-neutral-200"
            />
          </div>
        )}

        {/* Feedback messages */}
        {feedback && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800">
            {feedback}
          </div>
        )}

        {/* Status transition operations */}
        {(pickup.status === "requested" || pickup.status === "assigned") && (
          <div className="border-t border-neutral-100 pt-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Update Collection Status
            </h3>

            {isCompleting ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                <p className="text-xs font-semibold text-emerald-900">
                  Confirm Measured Weight (kg) & Complete Pickup:
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    placeholder={`e.g. ${pickup.wasteQuantity || 2.5}`}
                    value={measuredWeight}
                    onChange={(e) => setMeasuredWeight(e.target.value)}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <span className="self-center text-xs text-neutral-600">kg</span>
                  <button
                    onClick={handleCompletePickup}
                    disabled={completeMutation.isPending}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    {completeMutation.isPending ? "Completing…" : "Confirm & Award Points"}
                  </button>
                  <button
                    onClick={() => setIsCompleting(false)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsCompleting(true)}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs"
                >
                  ✓ Mark Completed (Weigh & Award Points)
                </button>

                <button
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  ✕ Reject Pickup
                </button>

                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel Pickup
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <AssignCollectorModal
          pickup={pickup}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => refetch()}
        />
      )}

      {showRejectModal && (
        <RejectPickupModal
          pickup={pickup}
          onClose={() => setShowRejectModal(false)}
          onRejected={() => refetch()}
        />
      )}

      {showUserModal && (
        <UserProfileModal
          userId={pickup.userId}
          onClose={() => setShowUserModal(false)}
        />
      )}
    </div>
  );
}
