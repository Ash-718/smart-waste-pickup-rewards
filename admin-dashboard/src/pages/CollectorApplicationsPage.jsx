import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCollectorApplications,
  approveCollectorApplication,
  rejectCollectorApplication,
} from "../api/collectorApplications";
import { getVehicles } from "../api/admin";

export default function CollectorApplicationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectModalApp, setInspectModalApp] = useState(null);
  const [approveModalApp, setApproveModalApp] = useState(null);
  const [rejectModalApp, setRejectModalApp] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Fetch applications
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["collectorApplications", activeTab, searchQuery],
    queryFn: () => getCollectorApplications({ status: activeTab, search: searchQuery }),
  });

  // Fetch fleet vehicles for vehicle assignment during approval
  const { data: vehiclesData } = useQuery({
    queryKey: ["adminVehicles"],
    queryFn: getVehicles,
  });

  const applications = data?.applications || [];
  const summary = data?.summary || { total: 0, pending: 0, approved: 0, rejected: 0 };
  const vehicles = vehiclesData?.vehicles || [];

  // Available vehicles for assignment: vehicles without driver or where driver is null
  const availableVehicles = vehicles.filter((v) => !v.driverId && v.isActive);

  // Approval Mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, vehicleId }) => approveCollectorApplication(id, vehicleId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["collectorApplications"] });
      queryClient.invalidateQueries({ queryKey: ["adminVehicles"] });
      queryClient.invalidateQueries({ queryKey: ["adminCollectors"] });
      setActionSuccess(res.message || "Collector application approved successfully!");
      setApproveModalApp(null);
      setInspectModalApp(null);
      setSelectedVehicleId("");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err) => {
      setActionError(err.message || "Failed to approve application.");
    },
  });

  // Rejection Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectCollectorApplication(id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["collectorApplications"] });
      setActionSuccess(res.message || "Collector application rejected.");
      setRejectModalApp(null);
      setInspectModalApp(null);
      setRejectionReason("");
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err) => {
      setActionError(err.message || "Failed to reject application.");
    },
  });

  const handleOpenApprove = (app) => {
    setActionError(null);
    setApproveModalApp(app);
    setSelectedVehicleId("");
  };

  const handleOpenReject = (app) => {
    setActionError(null);
    setRejectModalApp(app);
    setRejectionReason("");
  };

  const submitApprove = () => {
    if (!approveModalApp) return;
    approveMutation.mutate({
      id: approveModalApp.id,
      vehicleId: selectedVehicleId || undefined,
    });
  };

  const submitReject = () => {
    if (!rejectModalApp) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      setActionError("Please provide a rejection reason (minimum 3 characters).");
      return;
    }
    rejectMutation.mutate({
      id: rejectModalApp.id,
      reason: rejectionReason.trim(),
    });
  };

  const quickReasonChips = [
    "Commercial driving license verification failed",
    "Incomplete or invalid address details",
    "Duplicate application detected",
    "No current vehicle capacity in specified zone",
    "Background verification check requirements not satisfied",
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 flex items-center gap-2">
            <span>📋</span> Collector Applications & Onboarding
          </h1>
          <p className="text-sm text-neutral-500">
            Review driver onboarding requests, verify credentials, assign fleet vehicles, and manage collector roles.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-all cursor-pointer"
        >
          <span>🔄</span> Refresh Queue
        </button>
      </div>

      {/* Feedback Messages */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-2xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>✅</span> {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ×
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-2xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>⚠️</span> {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-600 hover:text-red-900 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total */}
        <div
          onClick={() => setActiveTab("all")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            activeTab === "all"
              ? "border-neutral-900 bg-neutral-900 text-white shadow-md"
              : "border-neutral-200/80 bg-white hover:border-neutral-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === "all" ? "text-neutral-400" : "text-neutral-500"}`}>
              Total Applications
            </span>
            <span className="text-lg">📁</span>
          </div>
          <div className="mt-2 text-3xl font-extrabold">{summary.total}</div>
          <div className={`mt-1 text-xs ${activeTab === "all" ? "text-neutral-300" : "text-neutral-500"}`}>
            All received onboarding records
          </div>
        </div>

        {/* Pending */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden ${
            activeTab === "pending"
              ? "border-amber-500 bg-amber-500 text-white shadow-md"
              : "border-amber-200/80 bg-amber-50/50 hover:border-amber-300 shadow-2xs"
          }`}
        >
          {summary.pending > 0 && activeTab !== "pending" && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          )}
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === "pending" ? "text-amber-100" : "text-amber-700"}`}>
              Pending Review
            </span>
            <span className="text-lg">⏳</span>
          </div>
          <div className={`mt-2 text-3xl font-extrabold ${activeTab === "pending" ? "text-white" : "text-amber-900"}`}>
            {summary.pending}
          </div>
          <div className={`mt-1 text-xs ${activeTab === "pending" ? "text-amber-100" : "text-amber-700"}`}>
            Awaiting admin decision
          </div>
        </div>

        {/* Approved */}
        <div
          onClick={() => setActiveTab("approved")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            activeTab === "approved"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-md"
              : "border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === "approved" ? "text-emerald-100" : "text-emerald-700"}`}>
              Approved Drivers
            </span>
            <span className="text-lg">✅</span>
          </div>
          <div className={`mt-2 text-3xl font-extrabold ${activeTab === "approved" ? "text-white" : "text-emerald-900"}`}>
            {summary.approved}
          </div>
          <div className={`mt-1 text-xs ${activeTab === "approved" ? "text-emerald-100" : "text-emerald-700"}`}>
            Active collector accounts
          </div>
        </div>

        {/* Rejected */}
        <div
          onClick={() => setActiveTab("rejected")}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            activeTab === "rejected"
              ? "border-red-600 bg-red-600 text-white shadow-md"
              : "border-red-200/80 bg-red-50/40 hover:border-red-300 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === "rejected" ? "text-red-100" : "text-red-700"}`}>
              Rejected
            </span>
            <span className="text-lg">❌</span>
          </div>
          <div className={`mt-2 text-3xl font-extrabold ${activeTab === "rejected" ? "text-white" : "text-red-900"}`}>
            {summary.rejected}
          </div>
          <div className={`mt-1 text-xs ${activeTab === "rejected" ? "text-red-100" : "text-red-700"}`}>
            Declined applications
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All Applications", count: summary.total },
            { id: "pending", label: "Pending", count: summary.pending },
            { id: "approved", label: "Approved", count: summary.approved },
            { id: "rejected", label: "Rejected", count: summary.rejected },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-neutral-900 text-white shadow-2xs"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  activeTab === tab.id ? "bg-neutral-700 text-white" : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] sm:w-72">
          <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, phone, license..."
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 py-1.5 pr-3 pl-9 text-xs text-neutral-800 placeholder-neutral-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-2 flex items-center text-xs text-neutral-400 hover:text-neutral-700"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Applications List Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-2xs">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <span className="text-3xl animate-spin">⏳</span>
            <p className="mt-3 text-sm font-semibold text-neutral-600">Loading collector applications...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">
            <p className="font-bold">Error loading applications</p>
            <p className="text-xs mt-1 text-red-500">{error?.message || "An unexpected error occurred."}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-4xl block mb-2">📭</span>
            <p className="text-sm font-bold text-neutral-800">No applications found</p>
            <p className="text-xs text-neutral-500 mt-1">
              {searchQuery
                ? `No applications matched "${searchQuery}".`
                : activeTab !== "all"
                ? `There are no ${activeTab} applications at this time.`
                : "No collector applications have been submitted yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200/80 bg-neutral-50 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-5 py-3.5">Applicant</th>
                  <th className="px-4 py-3.5">Contact Details</th>
                  <th className="px-4 py-3.5">License & Pref</th>
                  <th className="px-4 py-3.5">Applied Date</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Assigned Vehicle</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-neutral-50/60 transition-colors">
                    {/* Applicant Name & Avatar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 font-bold text-white shadow-2xs">
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-neutral-900 text-sm">{app.name}</div>
                          <div className="text-[11px] text-neutral-400 font-mono">ID: {app.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>

                    {/* Contact Details */}
                    <td className="px-4 py-4">
                      <div className="font-medium text-neutral-800">{app.email}</div>
                      <div className="text-neutral-500 text-[11px] mt-0.5">{app.phone}</div>
                      <div className="text-neutral-400 text-[10px] truncate max-w-[200px]" title={app.address}>
                        📍 {app.address}
                      </div>
                    </td>

                    {/* License & Preference */}
                    <td className="px-4 py-4">
                      <div>
                        {app.licenseNumber ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 border border-blue-200/60">
                            🪪 {app.licenseNumber}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic">None provided</span>
                        )}
                      </div>
                      {app.vehicleTypePref && (
                        <div className="text-[11px] text-neutral-500 mt-1">
                          🚗 <span className="capitalize">{app.vehicleTypePref.replace("_", " ")}</span>
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 whitespace-nowrap text-neutral-600">
                      <div>{new Date(app.createdAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-neutral-400">{new Date(app.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {app.status === "pending" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          Pending Review
                        </span>
                      )}
                      {app.status === "approved" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                          <span>✓</span> Approved Driver
                        </span>
                      )}
                      {app.status === "rejected" && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-800 cursor-help"
                          title={app.rejectionReason || "Application rejected"}
                        >
                          <span>✕</span> Rejected
                        </span>
                      )}
                    </td>

                    {/* Assigned Vehicle */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {app.assignedVehicle ? (
                        <div className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50/70 border border-emerald-200/60 rounded-lg px-2 py-1 inline-block">
                          🚛 {app.assignedVehicle.registrationNo}
                        </div>
                      ) : app.status === "approved" ? (
                        <span className="text-neutral-400 italic">No vehicle assigned</span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setInspectModalApp(app)}
                          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 shadow-2xs transition-all cursor-pointer"
                        >
                          Inspect
                        </button>

                        {app.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleOpenApprove(app)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs transition-all cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleOpenReject(app)}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 shadow-2xs transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail / Inspection Modal */}
      {inspectModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/70 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 font-bold text-white shadow-xs">
                  {inspectModalApp.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">{inspectModalApp.name}</h3>
                  <p className="text-xs text-neutral-500">Collector Onboarding Application Details</p>
                </div>
              </div>
              <button
                onClick={() => setInspectModalApp(null)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200/50 hover:text-neutral-700 font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Status Banner */}
              <div
                className={`rounded-xl p-3.5 border flex items-center justify-between ${
                  inspectModalApp.status === "pending"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : inspectModalApp.status === "approved"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-red-50 border-red-200 text-red-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {inspectModalApp.status === "pending" ? "⏳" : inspectModalApp.status === "approved" ? "✅" : "❌"}
                  </span>
                  <div>
                    <div className="font-bold capitalize">Status: {inspectModalApp.status}</div>
                    <div className="text-[11px] opacity-80">
                      {inspectModalApp.status === "pending"
                        ? "Awaiting review and authorization"
                        : inspectModalApp.status === "approved"
                        ? `Approved by ${inspectModalApp.reviewedBy?.name || "Administrator"} on ${new Date(
                            inspectModalApp.reviewedAt
                          ).toLocaleDateString()}`
                        : `Rejected by ${inspectModalApp.reviewedBy?.name || "Administrator"} on ${new Date(
                            inspectModalApp.reviewedAt
                          ).toLocaleDateString()}`}
                    </div>
                  </div>
                </div>
              </div>

              {inspectModalApp.rejectionReason && (
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-red-800">
                  <span className="font-bold block mb-1">Rejection Reason:</span>
                  <p className="text-[11px]">{inspectModalApp.rejectionReason}</p>
                </div>
              )}

              {/* Applicant Information Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Email Address
                  </span>
                  <span className="font-semibold text-neutral-800">{inspectModalApp.email}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Phone Number
                  </span>
                  <span className="font-semibold text-neutral-800">{inspectModalApp.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Driving License
                  </span>
                  <span className="font-semibold text-neutral-800 font-mono">
                    {inspectModalApp.licenseNumber || "Not provided"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Vehicle Preference
                  </span>
                  <span className="font-semibold text-neutral-800 capitalize">
                    {inspectModalApp.vehicleTypePref ? inspectModalApp.vehicleTypePref.replace("_", " ") : "Any vehicle"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Registered Residential Address
                  </span>
                  <span className="font-semibold text-neutral-800">{inspectModalApp.address}</span>
                </div>
              </div>

              {/* Account & Vehicle Information if Approved */}
              {inspectModalApp.status === "approved" && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
                  <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-xs">
                    <span>🚛</span> Linked Collector Account & Assigned Vehicle
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-neutral-500">Account ID:</span>{" "}
                      <span className="font-mono">{inspectModalApp.userId || "—"}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Role:</span> <span className="font-bold text-emerald-700">collector</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-neutral-500">Assigned Fleet Vehicle:</span>{" "}
                      {inspectModalApp.assignedVehicle ? (
                        <span className="font-bold text-neutral-800 font-mono">
                          {inspectModalApp.assignedVehicle.registrationNo} ({inspectModalApp.assignedVehicle.type})
                        </span>
                      ) : (
                        <span className="italic text-neutral-400">None currently assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* History Timeline */}
              <div className="border-t border-neutral-100 pt-3">
                <span className="text-[11px] font-bold text-neutral-700 block mb-2">Audit & History</span>
                <div className="space-y-1.5 text-[11px] text-neutral-500">
                  <div>
                    📅 <span className="font-medium text-neutral-700">Submitted:</span>{" "}
                    {new Date(inspectModalApp.createdAt).toLocaleString()}
                  </div>
                  {inspectModalApp.reviewedAt && (
                    <div>
                      ✍️ <span className="font-medium text-neutral-700">Reviewed:</span>{" "}
                      {new Date(inspectModalApp.reviewedAt).toLocaleString()} by{" "}
                      {inspectModalApp.reviewedBy?.name || "Administrator"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50/70 px-6 py-3.5">
              <button
                onClick={() => setInspectModalApp(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Close
              </button>

              {inspectModalApp.status === "pending" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const app = inspectModalApp;
                      setInspectModalApp(null);
                      handleOpenReject(app);
                    }}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      const app = inspectModalApp;
                      setInspectModalApp(null);
                      handleOpenApprove(app);
                    }}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Approve Driver
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approveModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-neutral-100 bg-emerald-50/60 px-6 py-4">
              <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                <span>✅</span> Approve Collector Application
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Confirming will activate a collector account for <strong className="text-neutral-900">{approveModalApp.name}</strong>.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-3.5 space-y-1">
                <div><strong>Email:</strong> {approveModalApp.email}</div>
                <div><strong>Phone:</strong> {approveModalApp.phone}</div>
                <div><strong>License:</strong> {approveModalApp.licenseNumber || "N/A"}</div>
                <div><strong>Address:</strong> {approveModalApp.address}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Assign Fleet Vehicle (Optional)
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-800 focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- No vehicle assignment (assign later) --</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registrationNo} — {v.type} (Cap: {v.capacity}kg)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">
                  You can assign or switch vehicles at any time under the Vehicles management tab.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setApproveModalApp(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={submitApprove}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {approveMutation.isPending ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-neutral-100 bg-red-50/60 px-6 py-4">
              <h3 className="text-base font-bold text-red-950 flex items-center gap-2">
                <span>❌</span> Reject Collector Application
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                Rejecting application for <strong className="text-neutral-900">{rejectModalApp.name}</strong>.
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Select Predefined Reason:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {quickReasonChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRejectionReason(chip)}
                      className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300 text-left transition-all"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-800 mb-1.5">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this application was not approved..."
                  className="w-full rounded-xl border border-neutral-200 bg-white p-2.5 text-xs text-neutral-800 focus:border-red-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  This explanation will be visible to the applicant if they query their application status or attempt login.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/70 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setRejectModalApp(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                onClick={submitReject}
                className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
