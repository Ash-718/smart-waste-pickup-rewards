import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getAdminCollectors,
} from "../api/admin";

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formError, setFormError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    registrationNo: "",
    type: "Electric Mini Van",
    capacity: 500,
    driverId: "",
    isActive: true,
  });

  // 1. Fetch all fleet vehicles
  const { data: vehiclesData, isLoading, isError, error } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  const vehicles = vehiclesData?.vehicles || [];

  // 2. Fetch all collectors for driver assignment dropdown
  const { data: collectorsData } = useQuery({
    queryKey: ["adminCollectors"],
    queryFn: getAdminCollectors,
  });

  const collectors = collectorsData?.collectors || [];

  // Filter available collectors: users with role 'collector' who don't already have a vehicle assigned
  // (unless it's the currently editing vehicle's driver)
  const availableCollectors = useMemo(() => {
    const assignedDriverIds = new Set(
      vehicles
        .filter((v) => v.driverId && (!editingVehicle || v.id !== editingVehicle.id))
        .map((v) => v.driverId)
    );

    return collectors.filter((c) => !assignedDriverIds.has(c.id));
  }, [collectors, vehicles, editingVehicle]);

  // Mutations
  const createMut = useMutation({
    mutationFn: createVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      queryClient.invalidateQueries({ queryKey: ["adminLiveFleet"] });
      closeModal();
    },
    onError: (err) => setFormError(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      queryClient.invalidateQueries({ queryKey: ["adminLiveFleet"] });
      closeModal();
    },
    onError: (err) => setFormError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      queryClient.invalidateQueries({ queryKey: ["adminLiveFleet"] });
    },
    onError: (err) => alert(`Failed to delete vehicle: ${err.message}`),
  });

  const openCreateModal = () => {
    setFormError(null);
    setEditingVehicle(null);
    setFormData({
      registrationNo: "",
      type: "Electric Mini Van",
      capacity: 500,
      driverId: "",
      isActive: true,
    });
    setModalMode("create");
  };

  const openEditModal = (vehicle) => {
    setFormError(null);
    setEditingVehicle(vehicle);
    setFormData({
      registrationNo: vehicle.registrationNo,
      type: vehicle.type,
      capacity: vehicle.capacity,
      driverId: vehicle.driverId || "",
      isActive: vehicle.isActive,
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingVehicle(null);
    setFormError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    const reg = formData.registrationNo.trim().toUpperCase();
    if (!reg) {
      setFormError("Registration number is required");
      return;
    }
    if (reg.length < 3) {
      setFormError("Registration number must be at least 3 characters");
      return;
    }

    const vType = formData.type.trim();
    if (!vType) {
      setFormError("Vehicle type is required");
      return;
    }

    const cap = Number(formData.capacity);
    if (isNaN(cap) || cap <= 0) {
      setFormError("Vehicle capacity must be greater than 0 kg");
      return;
    }

    const payload = {
      registrationNo: reg,
      type: vType,
      capacity: cap,
      driverId: formData.driverId ? formData.driverId : null,
      isActive: Boolean(formData.isActive),
    };

    if (modalMode === "create") {
      createMut.mutate(payload);
    } else if (modalMode === "edit") {
      updateMut.mutate({ id: editingVehicle.id, data: payload });
    }
  };

  const handleToggleActive = (vehicle) => {
    updateMut.mutate({
      id: vehicle.id,
      data: { isActive: !vehicle.isActive },
    });
  };

  const handleDelete = (vehicle) => {
    if (confirm(`Are you sure you want to delete vehicle ${vehicle.registrationNo}?`)) {
      deleteMut.mutate(vehicle.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-900 tracking-tight">Fleet & Vehicle Management</h1>
          <p className="text-xs text-neutral-500 mt-1">
            Register collection vehicles, assign licensed collectors, and manage active status
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-700 shadow-xs transition"
        >
          <span>+ Add New Vehicle</span>
        </button>
      </div>

      {/* Vehicles Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
        {isLoading && (
          <div className="p-8 text-center text-xs text-neutral-500">Loading fleet vehicles...</div>
        )}

        {isError && (
          <div className="p-4 m-4 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            Error loading vehicles: {error.message}
          </div>
        )}

        {!isLoading && vehicles.length === 0 && (
          <div className="p-12 text-center">
            <span className="text-3xl block mb-2">🚛</span>
            <h3 className="font-bold text-sm text-neutral-800">No vehicles registered</h3>
            <p className="text-xs text-neutral-500 mt-1">Get started by adding your first fleet vehicle above.</p>
          </div>
        )}

        {!isLoading && vehicles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Registration</th>
                  <th className="px-5 py-3.5">Vehicle Type</th>
                  <th className="px-5 py-3.5">Capacity</th>
                  <th className="px-5 py-3.5">Assigned Driver</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-neutral-50/60 transition">
                    <td className="px-5 py-4 font-bold text-neutral-900 flex items-center gap-2">
                      <span className="text-base">🚛</span>
                      <span>{v.registrationNo}</span>
                      {v.registrationNo === "LEGACY-UNASSIGNED" && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-semibold">
                          Placeholder
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-700 font-medium">{v.type}</td>
                    <td className="px-5 py-4 text-neutral-600">{v.capacity} kg</td>
                    <td className="px-5 py-4">
                      {v.driver ? (
                        <div>
                          <span className="font-semibold text-neutral-900 block">{v.driver.name}</span>
                          <span className="text-[11px] text-neutral-400">{v.driver.phone || v.driver.email}</span>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(v)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition ${
                          v.isActive
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {v.isActive ? "● Active" : "○ Inactive"}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(v)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                      >
                        Edit
                      </button>
                      {v.registrationNo !== "LEGACY-UNASSIGNED" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded-lg hover:bg-red-100 transition"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Vehicle Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
              <h2 className="text-base font-bold text-neutral-900">
                {modalMode === "create" ? "Add New Fleet Vehicle" : `Edit Vehicle ${editingVehicle?.registrationNo}`}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Registration Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH-02-WW-2026"
                  value={formData.registrationNo}
                  onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold uppercase"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Vehicle Type</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electric Mini Van, Tata Ace Recycler"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Waste Capacity (kg)</label>
                <input
                  type="number"
                  required
                  min="50"
                  step="10"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">
                  Assigned Driver (Collector)
                </label>
                <select
                  value={formData.driverId}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">-- No Driver Assigned --</option>
                  {editingVehicle?.driver && (
                    <option value={editingVehicle.driver.id}>
                      {editingVehicle.driver.name} (Current Driver)
                    </option>
                  )}
                  {availableCollectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Only staff with role 'collector' without an active vehicle are available.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-neutral-700 cursor-pointer">
                  Vehicle is active and ready for dispatch
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {createMut.isPending || updateMut.isPending
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Add Vehicle"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
