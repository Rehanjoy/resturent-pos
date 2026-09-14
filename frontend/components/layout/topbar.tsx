"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth/types";
import { useSocketConnectionState } from "@/lib/hooks/use-socket-connection-state";
import { useUiStore } from "@/lib/store/ui-store";
import { BellIcon, ClockIcon, MenuIcon, PlusIcon, SearchIcon } from "@/components/icons";

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

  const dotColor = connected ? "bg-success" : "bg-warning";
  const textColor = connected ? "text-success" : "text-warning";

  return (
    <>
      {/* Desktop live pill */}
      <div
        className="hidden items-center gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-small font-medium sm:flex"
        title={connected ? "Receiving live updates" : "Reconnecting to live updates…"}
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={textColor}>{connected ? "Live" : "Reconnecting…"}</span>
      </div>

      {/* Mobile live indicator dot */}
      <div
        className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-xs font-medium sm:hidden"
        title={connected ? "Live updates active" : "Reconnecting to live updates…"}
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dotColor} opacity-75`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
        </span>
        <span className={`text-[11px] font-semibold ${textColor}`}>{connected ? "Live" : "…"}</span>
      </div>
    </>
  );
}

/**
 * Shared top bar for the admin/POS shell: search, live clock, kitchen queue
 * notifications, and the primary "+ New Order" CTA.
 */
export function Topbar({ user }: { user: AuthUser }) {
  const clock = useLiveClock();
  const canStartOrder = NEW_ORDER_ROLES.has(user.role);
  const toggleMobileNav = useUiStore((state) => state.toggleMobileNav);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-surface/90 backdrop-blur-md px-3 sm:gap-4 sm:px-6">
      {/* Left side: Mobile Brand & Hamburger / Desktop Search */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-lg">
        {/* Hamburger + Brand on mobile (< lg) */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleMobileNav}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/70 text-text-muted transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-95"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5 sm:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="Saffron" width={22} height={22} className="h-5.5 w-5.5" />
            <span className="font-heading text-small font-bold tracking-tight text-text">Saffron</span>
          </div>
        </div>

        {/* Global Search Bar */}
        <form action="/admin/tables" className="relative hidden flex-1 sm:block">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            name="q"
            placeholder="Find a table, dish, or bill…"
            aria-label="Find a table, dish, or bill, press Enter to search"
            className="w-full rounded-xl border border-border/80 bg-background/70 py-2 pl-9 pr-12 text-small text-text placeholder:text-text-muted/80 transition-all focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden select-none rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted md:inline-flex">
            /
          </kbd>
        </form>
      </div>

      {/* Right side: Status, Clock, Kitchen Bell, New Order CTA */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <ConnectionStatus />

        <div className="hidden items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-1.5 text-small font-medium tabular-nums text-text-muted md:flex">
          <ClockIcon className="h-4 w-4 text-primary/70" />
          <span>{clock}</span>
        </div>

        <Link
          href="/admin/kitchen"
          title="Live kitchen queue"
          aria-label="Open live kitchen queue"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background/60 text-text-muted transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-95"
        >
          <BellIcon className="h-4 w-4" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
        </Link>

        {canStartOrder && (
          <Link
            href="/admin/tables"
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-button font-semibold text-white shadow-sm hover:bg-primary hover:shadow-md transition-all active:scale-95"
          >
            <PlusIcon className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">New Order</span>
            <span className="sm:hidden text-xs font-bold">Order</span>
          </Link>
        )}
      </div>
    </header>
  );
}
