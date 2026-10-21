import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPickup, updatePickupStatus } from "../api/pickups";
import { updatePickupCoordinates } from "../api/admin";
import { getMediaUrl } from "../lib/apiClient";
import { useMeta } from "../hooks/useMeta";
import StatusBadge from "../components/StatusBadge";
import ErrorState from "../components/ErrorState";
import { CardSkeleton } from "../components/Skeleton";
import AssignVehicleModal from "../components/AssignVehicleModal";
import RejectPickupModal from "../components/RejectPickupModal";
import UserProfileModal from "../components/UserProfileModal";

function stripCollectorSuffix(name) {
  if (!name) return "";
  return name.replace(/\s*\(Fleet Collector\)/gi, "").trim();
}

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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [coordError, setCoordError] = useState(null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

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

  async function handleGeocodeAddress() {
    setIsGeocoding(true);
    setCoordError(null);
    const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "support@pruthvi.ngo";
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          pickup.address
        )}&limit=1`,
        {
          headers: { "User-Agent": `WasteWise-App/1.0 (${contactEmail})` },
        }
      );
      if (!res.ok) throw new Error("Geocoding service unavailable");
      const data = await res.json();
      if (!data || data.length === 0) {
        throw new Error("Could not find coordinates for this address. Set manually.");
      }
      const lat = parseFloat(parseFloat(data[0].lat).toFixed(6));
      const lng = parseFloat(parseFloat(data[0].lon).toFixed(6));
      await updatePickupCoordinates(pickup.id, { latitude: lat, longitude: lng });
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
      setFeedback("Coordinates updated successfully via geocoding.");
    } catch (err) {
      setCoordError(err.message);
    } finally {
      setIsGeocoding(false);
    }
  }

  async function handleSaveManualCoords(e) {
    e.preventDefault();
    setCoordError(null);
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return setCoordError("Invalid coordinates. Latitude must be -90..90, Longitude -180..180.");
    }
    try {
      await updatePickupCoordinates(pickup.id, { latitude: lat, longitude: lng });
      setShowManualCoords(false);
      queryClient.invalidateQueries({ queryKey: ["pickup", id] });
      setFeedback("Coordinates updated successfully.");
    } catch (err) {
      setCoordError(err.message);
    }
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
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 transition ${
                    pickup.status === "requested"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  <span>🚛</span>
                  <span>{pickup.status === "assigned" ? "Reassign Vehicle" : "Assign Staff & Vehicle"}</span>
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 flex items-center gap-1.5 transition shadow-2xs"
                >
                  <span>✕</span>
                  <span>Reject Pickup</span>
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
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Assigned Fleet Vehicle</dt>
            <dd className="mt-1 text-sm font-bold text-neutral-900">
              {pickup.assignments?.[0]?.vehicle ? (
                pickup.assignments[0].vehicle.registrationNo === "LEGACY-UNASSIGNED" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Needs vehicle
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <span>🚛</span>
                      <span>{pickup.assignments[0].vehicle.registrationNo}</span>
                    </span>
                    <span className="block text-xs font-normal text-neutral-500 mt-0.5">
                      {pickup.assignments[0].vehicle.type} ({pickup.assignments[0].vehicle.capacity}kg)
                    </span>
                  </>
                )
              ) : (
                <span className="text-neutral-400 font-normal italic">No fleet vehicle assigned</span>
              )}
            </dd>
          </div>

          <div className="rounded-xl bg-neutral-50 p-3">
            <dt className="font-semibold uppercase tracking-wider text-neutral-500">Assigned Driver / Staff</dt>
            <dd className="mt-1 text-sm font-bold text-blue-900">
              {pickup.assignments?.[0]?.vehicle?.driver ? (
                <>
                  {stripCollectorSuffix(pickup.assignments[0].vehicle.driver.name)}
                  {pickup.assignments[0].vehicle.driver.phone && (
                    <span className="block text-xs font-normal text-neutral-500">
                      Phone: {pickup.assignments[0].vehicle.driver.phone}
                    </span>
                  )}
                </>
              ) : pickup.assignedAdmin ? (
                <>
                  {stripCollectorSuffix(pickup.assignedAdmin.name)} ({pickup.assignedAdmin.role})
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
            <div className="flex items-center justify-between">
              <dt className="font-semibold uppercase tracking-wider text-neutral-500">Collection Address & GPS</dt>
              {pickup.latitude != null && pickup.longitude != null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  📍 {pickup.latitude.toFixed(5)}, {pickup.longitude.toFixed(5)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                  ⚠️ No Coordinates
                </span>
              )}
            </div>
            <dd className="mt-1 text-sm font-medium text-neutral-900">{pickup.address}</dd>

            {/* Coordinates missing warning & admin fix tools */}
            {(pickup.latitude == null || pickup.longitude == null) && (
              <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-800">
                    Destination coordinates missing. Arrival check will be blocked until coordinates are set.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isGeocoding}
                      onClick={handleGeocodeAddress}
                      className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {isGeocoding ? "Geocoding..." : "Auto-Geocode Address"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualCoords(!showManualCoords)}
                      className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      {showManualCoords ? "Cancel" : "Set Manually"}
                    </button>
                  </div>
                </div>

                {coordError && <p className="mt-1 text-rose-600 font-medium">{coordError}</p>}

                {showManualCoords && (
                  <form onSubmit={handleSaveManualCoords} className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="Latitude (e.g. 19.076)"
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      required
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Longitude (e.g. 72.877)"
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
                      required
                    />
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700"
                    >
                      Save Coordinates
                    </button>
                  </form>
                )}
              </div>
            )}
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
              src={getMediaUrl(pickup.photoUrl)}
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
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  disabled={pickup.status === "on_the_way" || pickup.status === "arrived"}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition ${
                    pickup.status === "on_the_way" || pickup.status === "arrived"
                      ? "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
                      : "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  {pickup.assignments?.[0]?.vehicle || pickup.assignedAdmin
                    ? "🔄 Reassign Vehicle & Driver"
                    : "🚛 Assign Vehicle & Driver"}
                </button>

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
        <AssignVehicleModal
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
