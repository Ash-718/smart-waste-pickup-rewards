import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard Overview", icon: "📊" },
  { to: "/analytics", label: "Analytics & Trends", icon: "📈" },
  { to: "/queue", label: "Pickup Queue", icon: "🚚" },
  { to: "/users", label: "Citizens & Impact", icon: "👥" },
  { to: "/rewards-badges", label: "Rewards & Staff", icon: "🎁" },
];

function navLinkClass({ isActive }) {
  return [
    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all",
    isActive
      ? "bg-emerald-50 text-emerald-900 border border-emerald-200/60 shadow-2xs font-bold"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  ].join(" ");
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8faf9] md:flex">
      <aside className="border-b border-neutral-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-neutral-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-extrabold text-white shadow-xs">
            🌱
          </span>
          <div>
            <span className="text-sm font-bold text-neutral-900 block leading-tight">WasteWise Admin</span>
            <span className="text-[10px] text-emerald-700 font-medium">Pruthvi Foundation</span>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <div className="text-sm text-neutral-500">Pruthvi ZeroWaste Foundation</div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-800">{user?.name}</span>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
