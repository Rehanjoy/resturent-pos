"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth/types";
import { useSocketConnectionState } from "@/lib/hooks/use-socket-connection-state";
import { BellIcon, ClockIcon, PlusIcon, SearchIcon } from "@/components/icons";

// Same entry point the Table Grid's free-table cards use to start an order
// (`/admin/orders/new?tableId=...` requires a table first) — a global
// "+ New Order" button can't skip straight to the order screen without a
// table selected, so it sends staff to the screen where that selection
// actually happens. Role set mirrors the Tables nav entry in
// `components/layout/sidebar.tsx` (owner/manager/cashier/server — the
// roles that can actually start an order from the table grid).
const NEW_ORDER_ROLES = new Set(["owner", "manager", "cashier", "server"]);

function useLiveClock(): string {
  // Safe to compute `new Date()` directly (no SSR/hydration risk): this
  // component only ever renders once `AdminLayout`'s auth gate flips to
  // "authenticated", which is a client-only state transition that never
  // happens during the server-rendered pass (see `app/admin/layout.tsx`).
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Live/Reconnecting indicator — the professional touch that tells staff
 * whether the screen they're looking at is actually receiving real-time
 * updates right now, driven by `useSocketConnectionState`'s real
 * `connect`/`disconnect`/`reconnect` events (never a hardcoded "always
 * green" dot). Green + a subtle pulse when connected; amber + "Reconnecting…"
 * while the socket is down or retrying — colors straight from the brand
 * kit's semantic tokens (`--color-success` / `--color-warning`).
 */
function ConnectionStatus() {
  const state = useSocketConnectionState();
  const connected = state === "connected";

  // Tailwind's build-time scanner needs literal class strings (no
  // `` `bg-${tone}` `` template interpolation), so the two states are
  // spelled out in full rather than composed from a shared token name.
  const dotColor = connected ? "bg-success" : "bg-warning";
  const textColor = connected ? "text-success" : "text-warning";

  return (
    <div
      className="hidden items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-small font-medium sm:flex"
      title={connected ? "Receiving live updates" : "Reconnecting to live updates…"}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-pulse rounded-full ${dotColor} opacity-75`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      <span className={textColor}>{connected ? "Live" : "Reconnecting…"}</span>
    </div>
  );
}

/**
 * Shared top bar for the admin/POS shell: search (decorative — no search
 * endpoint exists yet, this is purely the layout slot the reference
 * screenshots call for), a live clock, a notifications bell (decorative —
 * no notification feed exists yet either; a follow-up part, not faked
 * here), and the primary "+ New Order" CTA. Staff identity + log out live
 * in the sidebar's bottom panel instead of here (see `sidebar.tsx`) — the
 * functionality moved, it wasn't removed.
 */
export function Topbar({ user }: { user: AuthUser }) {
  const clock = useLiveClock();
  const canStartOrder = NEW_ORDER_ROLES.has(user.role);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      <div className="relative flex-1 max-w-sm">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder="Search orders, tables..."
          aria-label="Search orders, tables"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-small text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ConnectionStatus />

        <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-small font-medium tabular-nums text-text-muted sm:flex">
          <ClockIcon className="h-4 w-4" />
          <span>{clock}</span>
        </div>

        <button
          type="button"
          title="Notifications"
          aria-label="Notifications"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-primary hover:text-primary"
        >
          <BellIcon className="h-4 w-4" />
        </button>

        {canStartOrder && (
          <Link
            href="/admin/tables"
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-button font-semibold text-white shadow-sm transition-colors hover:bg-primary"
          >
            <PlusIcon className="h-4 w-4" />
            New Order
          </Link>
        )}
      </div>
    </header>
  );
}
