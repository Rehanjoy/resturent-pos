"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/types";

/**
 * Top-level nav entries for the admin/POS shell. Role sets mirror the PRD
 * §2 RBAC matrix column-by-column; `roles: null` means "every authenticated
 * role can see this". Staff and Settings are both Owner/Manager only (Staff:
 * "Full"/"View/Add"; Settings: "Full"/"Partial" — no other role gets a nav
 * entry at all, matching "no access, not even view").
 */
const NAV_ITEMS: { href: string; label: string; roles: AuthUser["role"][] | null }[] = [
  // PRD §2 Dashboard column: Owner/Manager "Full", Cashier "View" — Server/
  // Chef/Inventory Manager get no nav entry at all (not even view).
  { href: "/admin", label: "Dashboard", roles: ["owner", "manager", "cashier"] },
  { href: "/admin/tables", label: "Tables", roles: ["owner", "manager", "cashier", "server"] },
  {
    href: "/admin/orders/active",
    label: "Orders",
    roles: ["owner", "manager", "cashier", "server", "chef"],
  },
  {
    href: "/admin/kitchen",
    label: "Kitchen",
    roles: ["owner", "manager", "cashier", "server", "chef"],
  },
  { href: "/admin/menu", label: "Menu", roles: null },
  // PRD §2 Reports column: Owner/Manager "Full", Cashier "sales only" (the
  // Staff Performance tab is hidden/blocked for Cashier inside the screen
  // itself and independently on the backend — see reports-screen.tsx).
  { href: "/admin/reports", label: "Reports", roles: ["owner", "manager", "cashier"] },
  { href: "/admin/staff", label: "Staff", roles: ["owner", "manager"] },
  { href: "/admin/settings", label: "Settings", roles: ["owner", "manager"] },
];

/**
 * Shared chrome for every /admin route (POS + Dashboard). Gates access to
 * an authenticated session, shows the staff-identity indicator (name, role,
 * log out) in the top bar, and renders a role-filtered nav row so a given
 * staff member only ever sees entries for modules they actually have
 * access to (PRD §2) — this is a UX convenience only, every route still
 * re-checks role server-side and each screen also gates itself.
 *
 * This is a client-side guard rather than `middleware.ts`: the access
 * token lives in memory only (see `lib/auth/token-store.ts`) and the
 * refresh cookie is httpOnly + opaque to the frontend, so Next.js
 * middleware (which runs before any client JS and can't call our React
 * context) can't verify auth state without re-implementing the refresh
 * flow at the edge or exposing the JWT secret there — a worse trade-off
 * than the brief loading flash this approach has while the initial
 * `/api/auth/refresh` call (made by `AuthProvider`) resolves.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { status, user, clearSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && user?.mustResetPassword) {
      router.replace("/reset-password");
    }
  }, [status, user, router]);

  const isGateOpen = status === "authenticated" && user && !user.mustResetPassword;

  if (!isGateOpen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-small text-text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
        <span className="font-heading text-lg font-semibold text-text">Saffron</span>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-small font-medium text-text">{user.name}</p>
            <p className="text-small capitalize text-text-muted">
              {user.role.replace("_", " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void clearSession().then(() => router.push("/login"));
            }}
            className="rounded-md border border-border px-3 py-1.5 text-small text-text-muted hover:text-text"
          >
            Log out
          </button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-6 py-2">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-small font-medium ${
                isActive ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
