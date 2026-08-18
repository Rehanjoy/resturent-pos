"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth/types";
import {
  BoxIcon,
  CalendarIcon,
  DashboardIcon,
  KitchenIcon,
  LogoutIcon,
  MenuBookIcon,
  OrdersIcon,
  ReportsIcon,
  SettingsIcon,
  StaffIcon,
  TableIcon,
  type IconProps,
} from "@/components/icons";

/**
 * Top-level nav entries for the admin/POS shell. Role sets mirror the PRD
 * §2 RBAC matrix column-by-column; `roles: null` means "every authenticated
 * role can see this". Staff and Settings are both Owner/Manager only (Staff:
 * "Full"/"View/Add"; Settings: "Full"/"Partial" — no other role gets a nav
 * entry at all, matching "no access, not even view"). Moved here from
 * `app/admin/layout.tsx` during the Phase 5 visual redesign — this file is
 * now the single source of truth for "what's in the nav rail and who sees
 * it"; Website is still not listed yet (separate build part). Inventory was
 * added when the Phase-2 Inventory module (PRD §3.9) was pulled forward —
 * role set is Owner/Manager/Inventory Manager (Full) and Chef (View,
 * "deduction only" per the PRD §2 RBAC matrix); Cashier/Server get no nav
 * entry at all, matching "no access". Reservations was added alongside it
 * for the same reason (PRD §3.7) — role set mirrors Tables' own view role
 * set exactly (Owner/Manager/Cashier/Server all see it; Chef/Inventory
 * Manager don't), since PRD §2 combines "Tables" and "Reservation" into one
 * RBAC column.
 */
const NAV_ITEMS: {
  href: string;
  label: string;
  roles: AuthUser["role"][] | null;
  icon: (props: IconProps) => React.ReactElement;
}[] = [
  // PRD §2 Dashboard column: Owner/Manager "Full", Cashier "View" — Server/
  // Chef/Inventory Manager get no nav entry at all (not even view).
  { href: "/admin", label: "Dashboard", roles: ["owner", "manager", "cashier"], icon: DashboardIcon },
  {
    href: "/admin/tables",
    label: "Tables",
    roles: ["owner", "manager", "cashier", "server"],
    icon: TableIcon,
  },
  {
    href: "/admin/reservations",
    label: "Reservations",
    roles: ["owner", "manager", "cashier", "server"],
    icon: CalendarIcon,
  },
  {
    href: "/admin/orders/active",
    label: "Orders",
    roles: ["owner", "manager", "cashier", "server", "chef"],
    icon: OrdersIcon,
  },
  {
    href: "/admin/kitchen",
    label: "Kitchen",
    roles: ["owner", "manager", "cashier", "server", "chef"],
    icon: KitchenIcon,
  },
  { href: "/admin/menu", label: "Menu", roles: null, icon: MenuBookIcon },
  {
    href: "/admin/inventory",
    label: "Inventory",
    roles: ["owner", "manager", "inventory_manager", "chef"],
    icon: BoxIcon,
  },
  // PRD §2 Reports column: Owner/Manager "Full", Cashier "sales only" (the
  // Staff Performance tab is hidden/blocked for Cashier inside the screen
  // itself and independently on the backend — see reports-screen.tsx).
  {
    href: "/admin/reports",
    label: "Reports",
    roles: ["owner", "manager", "cashier"],
    icon: ReportsIcon,
  },
  { href: "/admin/staff", label: "Staff", roles: ["owner", "manager"], icon: StaffIcon },
  { href: "/admin/settings", label: "Settings", roles: ["owner", "manager"], icon: SettingsIcon },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Dark, full-height nav rail — the one deliberate contrast-with-canvas
 * choice in the redesign (client reference screenshots). Role-filters
 * `NAV_ITEMS` exactly as the previous top-nav did; this is a UX convenience
 * only, every route still re-checks role server-side and each screen also
 * gates itself (see the individual screen components).
 */
export function Sidebar({
  role,
  user,
  onLogout,
}: {
  role: AuthUser["role"];
  user: AuthUser;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        {/* Plain <img>, not next/image — the built-in optimizer blocks SVG
            content-type by default (`images.dangerouslyAllowSVG`), and a
            fixed 32px decorative mark gets nothing from the optimizer
            anyway. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
        <div className="leading-tight">
          <p className="font-heading text-h4 font-semibold text-sidebar-foreground">Saffron POS</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
            Modern Kitchen
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              // Active state uses `text-button` (16px SemiBold) rather than
              // `text-small` (13px) white-on-coral — the brand kit only
              // certifies white text on the primary/accent coral as meeting
              // AA-large at 16px SemiBold minimum (docs/02-brand-kit.md
              // contrast notes); a smaller label here would fall below that
              // documented threshold.
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-button font-semibold transition-colors ${
                isActive
                  ? "bg-sidebar-active text-white shadow-sm"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-small font-semibold text-sidebar-foreground">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-small font-medium text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-[11px] capitalize text-sidebar-muted">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
