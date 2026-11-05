import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  DashboardIcon,
  AnalyticsIcon,
  ReportsIcon,
  ApplicationsIcon,
  LiveFleetIcon,
  VehicleIcon,
  PickupIcon,
  UsersIcon,
  RewardsIcon,
  BrandLogo,
} from "./Icons";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { to: "/queue", label: "Pickup Queue", Icon: PickupIcon },
  { to: "/vehicles", label: "Vehicles & Fleet", Icon: VehicleIcon, adminOnly: true },
  { to: "/fleet", label: "Live Telematics", Icon: LiveFleetIcon, adminOnly: true, hasLiveDot: true },
  { to: "/analytics", label: "Analytics & Trends", Icon: AnalyticsIcon },
  { to: "/reports", label: "Reports & Export", Icon: ReportsIcon, adminOnly: true },
  { to: "/collector-applications", label: "Staff Applications", Icon: ApplicationsIcon, adminOnly: true },
  { to: "/users", label: "Citizens & Impact", Icon: UsersIcon },
  { to: "/rewards-badges", label: "Rewards & Staff", Icon: RewardsIcon },
];

function navLinkClass({ isActive }) {
  return [
    "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 ease-out select-none active:scale-[0.98]",
    isActive
      ? "bg-emerald-50/80 text-emerald-950 border border-emerald-200/80 shadow-2xs font-bold"
      : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900 hover:translate-x-0.5",
  ].join(" ");
}

export default function Layout() {
  const { user, logout } = useAuth();
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin");

  return (
    <div className="min-h-screen bg-[#f8faf9] md:flex text-neutral-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      <aside className="border-b border-neutral-200/80 bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100">
            <BrandLogo className="w-9 h-9" />
            <div>
              <span className="text-sm font-extrabold text-neutral-900 block leading-tight tracking-tight">
                WasteWise
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                Municipal Operations
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 p-3">
            {visibleNavItems.map(({ to, label, Icon, hasLiveDot }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? "text-emerald-700 stroke-[2.2]" : "text-neutral-500"
                      }`}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {hasLiveDot && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Footprint */}
        <div className="p-3 border-t border-neutral-100 bg-neutral-50/50 m-2 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-neutral-900 block truncate">
                {user?.name || "Administrator"}
              </span>
              <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider block">
                {user?.role || "Staff"}
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 hover:border-neutral-300 transition-all cursor-pointer shadow-2xs"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Pruthvi ZeroWaste Command</span>
            <span className="text-neutral-300">/</span>
            <span className="text-neutral-700">Sangli-Miraj-Kupwad Municipal Corp</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-neutral-500 font-medium hidden sm:block">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
        </header>

        <main className="p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
