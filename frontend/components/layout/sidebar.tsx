"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth/types";
import { defaultModulesForRole, type StaffModule } from "@/lib/staff/types";
import { useUiStore } from "@/lib/store/ui-store";
import {
  BoxIcon,
  CalendarIcon,
  DashboardIcon,
  GlobeIcon,
  KitchenIcon,
  LogoutIcon,
  MegaphoneIcon,
  MenuBookIcon,
  OrdersIcon,
  ReceiptIcon,
  ReportsIcon,
  SettingsIcon,
  StaffIcon,
  TableIcon,
  XIcon,
  type IconProps,
} from "@/components/icons";

/**
 * Top-level nav entries for the admin/POS shell. Role sets mirror the PRD
 * §2 RBAC matrix column-by-column; `roles: null` means "every authenticated
 * role can see this".
 */
const NAV_ITEMS: {
  href: string;
  label: string;
  module: StaffModule;
  roles: AuthUser["role"][] | null;
  icon: (props: IconProps) => React.ReactElement;
}[] = [
  { href: "/admin", label: "Dashboard", module: "dashboard", roles: ["owner", "manager", "cashier"], icon: DashboardIcon },
  { href: "/admin/customers", label: "Customers", module: "customers", roles: ["owner", "manager", "cashier", "server"], icon: StaffIcon },
  {
    href: "/admin/tables",
    label: "Tables",
    module: "tables",
    roles: ["owner", "manager", "cashier", "server"],
    icon: TableIcon,
  },
  {
    href: "/admin/reservations",
    label: "Reservations",
    module: "reservations",
    roles: ["owner", "manager", "cashier", "server"],
    icon: CalendarIcon,
  },
  {
    href: "/admin/orders/active",
    label: "Orders",
    module: "orders",
    roles: ["owner", "manager", "cashier", "server", "chef"],
    icon: OrdersIcon,
  },
  {
    href: "/admin/kitchen",
    label: "Kitchen",
    module: "kitchen",
    roles: ["owner", "manager", "cashier", "server", "chef"],
    icon: KitchenIcon,
  },
  { href: "/admin/menu", label: "Menu", module: "menu", roles: null, icon: MenuBookIcon },
  {
    href: "/admin/inventory",
    label: "Inventory",
    module: "inventory",
    roles: ["owner", "manager", "inventory_manager", "chef"],
    icon: BoxIcon,
  },
  {
    href: "/admin/invoices",
    label: "Bills",
    module: "bills",
    roles: ["owner", "manager", "cashier"],
    icon: ReceiptIcon,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    module: "reports",
    roles: ["owner", "manager", "cashier"],
    icon: ReportsIcon,
  },
  { href: "/admin/staff", label: "Staff", module: "staff", roles: ["owner", "manager"], icon: StaffIcon },
  { href: "/admin/website", label: "Website", module: "website", roles: ["owner", "manager"], icon: GlobeIcon },
  { href: "/admin/marketing", label: "Marketing", module: "marketing", roles: ["owner", "manager"], icon: MegaphoneIcon },
  { href: "/admin/settings", label: "Settings", module: "settings", roles: ["owner", "manager"], icon: SettingsIcon },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Modern navigation rail (desktop) and off-canvas drawer (mobile/tablet).
 * Role-filters NAV_ITEMS according to RBAC. Uses `no-scrollbar` to prevent
 * native Windows scrollbars from squishing the rail icons.
 */
export function Sidebar({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const isMobileNavOpen = useUiStore((state) => state.isMobileNavOpen);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);
  const visibleModules = new Set(
    user.visibleModules?.length ? user.visibleModules : defaultModulesForRole(user.role),
  );
  const visibleItems = NAV_ITEMS.filter(
    (item) => visibleModules.has(item.module) && (!item.roles || item.roles.includes(user.role)),
  );

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={`glass-elevated fixed inset-y-0 left-0 z-50 flex h-full w-72 shrink-0 flex-col border-r border-white/80 text-sidebar-foreground transition-transform duration-300 ease-out sm:w-80 lg:sticky lg:top-0 lg:z-auto lg:m-3 lg:mr-0 lg:h-[calc(100vh-1.5rem)] lg:w-24 lg:translate-x-0 lg:rounded-[1.75rem] ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-sidebar-border/60 px-5 py-4 lg:border-b-0 lg:justify-center lg:px-2 lg:pt-5 lg:pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white bg-gradient-to-br from-white to-primary/10 shadow-sm transition-transform hover:scale-105">
              {/* Plain <img> to avoid SVG optimizer restrictions */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.svg" alt="Saffron" width={28} height={28} className="h-7 w-7" />
            </div>
            <div className="leading-tight lg:hidden">
              <p className="font-heading text-h4 font-bold tracking-tight text-sidebar-foreground">Saffron POS</p>
              <p className="text-[11px] font-medium tracking-wide text-sidebar-muted">
                Restaurant Management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMobileNav}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground lg:hidden"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation list with no-scrollbar to eliminate Windows native scrollbar */}
        <nav className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2.5 lg:px-2">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={closeMobileNav}
                className={`group flex min-h-12 items-center gap-3.5 rounded-xl px-3.5 py-3 text-body font-medium transition-all duration-200 lg:flex-col lg:gap-1 lg:px-1 lg:py-2.5 lg:text-[11px] ${
                  isActive
                    ? "bg-gradient-to-br from-primary to-accent font-semibold text-white shadow-[0_10px_24px_rgba(229,62,21,0.25)]"
                    : "text-sidebar-muted hover:bg-white/70 hover:text-sidebar-foreground active:scale-[.98]"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105 ${isActive ? "text-white" : "text-sidebar-muted group-hover:text-primary"}`} />
                <span className="truncate lg:leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Profile & Logout */}
        <div className="border-t border-sidebar-border/80 p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/55 p-2.5 shadow-sm backdrop-blur-xl lg:flex-col lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-small font-bold text-primary ring-2 ring-primary/20">
              {initialsOf(user.name)}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" title="Online" />
            </div>
            <div className="min-w-0 flex-1 leading-tight lg:hidden">
              <p className="truncate text-small font-semibold text-sidebar-foreground">{user.name}</p>
              <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {user.role.replace("_", " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-muted transition-all hover:bg-error/10 hover:text-error active:scale-95"
            >
              <LogoutIcon className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
