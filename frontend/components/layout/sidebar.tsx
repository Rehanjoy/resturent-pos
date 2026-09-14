"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthUser } from "@/lib/auth/types";
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
 * RBAC column. Website was added for the Website Builder module (PRD
 * §3.13) — role set is Owner/Manager only (PRD §2 Website column: Owner
 * "Full", Manager "View", every other role no access at all), matching
 * Staff/Settings' own Owner+Manager-only nav entries above. Marketing was
 * added for the WhatsApp marketing module (PRD §6 "WhatsApp Business API")
 * — Owner/Manager only, no other role gets a nav entry or access at all,
 * same gate as Staff/Settings/Website (this is Part 1 of 3: WhatsApp
 * connection Setup + Contacts; Part 2 adds Campaigns, Part 3 adds the AI
 * auto-reply Inbox, both as tabs inside the same screen, not new nav
 * entries).
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
  { href: "/admin/customers", label: "Customers", roles: ["owner", "manager", "cashier", "server"], icon: StaffIcon },
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
  // Bills/invoice history — same role set as every other billing action
  // in this app (PRD §2 Billing: Owner/Manager/Cashier "Create/Settle";
  // Server has no billing access at all).
  {
    href: "/admin/invoices",
    label: "Bills",
    roles: ["owner", "manager", "cashier"],
    icon: ReceiptIcon,
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
  { href: "/admin/website", label: "Website", roles: ["owner", "manager"], icon: GlobeIcon },
  { href: "/admin/marketing", label: "Marketing", roles: ["owner", "manager"], icon: MegaphoneIcon },
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
 *
 * Responsive behavior (PRD §7 — tablet support for POS/KDS terminals):
 * below the `lg` breakpoint this rail is an off-canvas drawer (fixed,
 * slides in from the left, backdrop closes it on tap-outside) driven by
 * `useUiStore`'s `isMobileNavOpen`; the hamburger toggle lives in
 * `topbar.tsx`. At `lg` and above it reverts to the original always-docked
 * rail — same breakpoint every other two-column layout in this app already
 * switches on (`cart-rail.tsx`, `billing-workspace.tsx`, `kds-board.tsx`),
 * so this doesn't introduce a new cutoff to reason about.
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
  const isMobileNavOpen = useUiStore((state) => state.isMobileNavOpen);
  const closeMobileNav = useUiStore((state) => state.closeMobileNav);
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      {/* Backdrop — mobile/tablet only (`lg:hidden`); docked desktop rail
          never renders this, `isMobileNavOpen` is simply never true there
          in practice since the toggle button is also `lg:hidden`. */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}

      <aside
        // Exactly one of `translate-x-0` / `-translate-x-full` is present at
        // a time (never both) so there's no same-specificity utility-order
        // ambiguity to reason about; `lg:translate-x-0` sits in its own
        // media-query layer and always wins at `lg`+ regardless of which of
        // the two base classes is active below it.
        //
        // `lg:sticky lg:top-0 lg:h-screen` (replacing the old `lg:static`):
        // the admin shell (`app/admin/layout.tsx`) is a `min-h-screen` flex
        // row with no shared scroll container, so on a tall screen (e.g.
        // Menu with many dishes) the whole page scrolls — a `static` rail
        // would scroll away with it. Sticky + capped to viewport height
        // keeps the rail pinned while the content column beside it scrolls
        // independently.
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-24 lg:translate-x-0 ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-5 pb-5 pt-6 lg:justify-center lg:px-2">
          {/* Plain <img>, not next/image — the built-in optimizer blocks SVG
              content-type by default (`images.dangerouslyAllowSVG`), and a
              fixed 32px decorative mark gets nothing from the optimizer
              anyway. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <div className="leading-tight lg:hidden">
            <p className="font-heading text-h4 font-semibold text-sidebar-foreground">Saffron POS</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
              Modern Kitchen
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                // Closes the mobile drawer on navigation — harmless on the
                // docked desktop rail (`isMobileNavOpen` has no visual
                // effect there since `lg:translate-x-0` always wins).
                onClick={closeMobileNav}
                // Active state uses `text-button` (16px SemiBold) rather than
                // `text-small` (13px) white-on-coral — the brand kit only
                // certifies white text on the primary/accent coral as meeting
                // AA-large at 16px SemiBold minimum (docs/02-brand-kit.md
                // contrast notes); a smaller label here would fall below that
                // documented threshold.
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-button font-semibold transition-colors lg:flex-col lg:gap-1.5 lg:px-1 lg:text-[10px] ${
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
          <div className="flex items-center gap-3 rounded-xl px-2 py-2 lg:flex-col">
            <span title={user.name} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-hover text-small font-semibold text-sidebar-foreground">
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0 flex-1 leading-tight lg:hidden">
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
    </>
  );
}
