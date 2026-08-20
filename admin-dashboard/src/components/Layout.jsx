import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/queue", label: "Pickup Queue" },
  { to: "/dashboard", label: "Impact Dashboard" },
];

function navLinkClass({ isActive }) {
  return [
    "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-brand-100 text-brand-800"
      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  ].join(" ");
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8faf9] md:flex">
      <aside className="border-b border-neutral-200 bg-white md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            W
          </span>
          <span className="text-sm font-semibold text-neutral-900">WasteWise Admin</span>
        </div>
        <nav className="space-y-1 px-3 pb-4">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
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
