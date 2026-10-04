"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AuthUser } from "@/lib/auth/types";
import { defaultModulesForRole } from "@/lib/staff/types";
import { useSocketConnectionState } from "@/lib/hooks/use-socket-connection-state";
import { useUiStore } from "@/lib/store/ui-store";
import { ClockIcon, MenuIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { NotificationCenter } from "@/components/notifications/notification-center";

// Same entry point the Table Grid's free-table cards use to start an order
// (`/admin/orders/new?tableId=...` requires a table first) — a global
// "+ New Order" button can't skip straight to the order screen without a
// table selected, so it sends staff to the screen where that selection
// actually happens. Role set mirrors the Tables nav entry in
// `components/layout/sidebar.tsx` (owner/manager/cashier/server — the
// roles that can actually start an order from the table grid).
const NEW_ORDER_ROLES = new Set(["owner", "manager", "cashier", "server"]);

function useLiveClock(): string {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initialId = window.setTimeout(() => setNow(new Date()), 0);
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initialId);
      clearInterval(id);
    };
  }, []);

  return now?.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) ?? "--:--:--";
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

function DemoTimer({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number>(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 300;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
        isUrgent
          ? "border-red-500/40 bg-red-500/10 text-red-600 animate-pulse"
          : "border-primary/40 bg-primary/10 text-primary"
      }`}
      title="Live Demo Session: auto-logouts when timer reaches 0"
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${isUrgent ? "bg-red-500" : "bg-primary"} opacity-75`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${isUrgent ? "bg-red-500" : "bg-primary"}`} />
      </span>
      <span>
        Demo: {minutes}:{seconds < 10 ? `0${seconds}` : seconds} left
      </span>
    </div>
  );
}

/**
 * Shared top bar for the admin/POS shell: search, live clock, kitchen queue
 * notifications, and the primary "+ New Order" CTA.
 */
export function Topbar({ user }: { user: AuthUser }) {
  const clock = useLiveClock();
  const visibleModules = new Set(user.visibleModules?.length ? user.visibleModules : defaultModulesForRole(user.role));
  const canStartOrder = NEW_ORDER_ROLES.has(user.role) && visibleModules.has("tables") && visibleModules.has("orders");
  const toggleMobileNav = useUiStore((state) => state.toggleMobileNav);

  const handleDemoExpired = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/login?demoExpired=1";
  };

  return (
    <header className="glass-panel sticky top-0 z-30 mx-2 mt-2 flex h-16 shrink-0 items-center justify-between gap-2 rounded-2xl px-3 sm:mx-4 sm:mt-3 sm:gap-4 sm:px-5 lg:mx-5">
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
            <img src="/logo-mark.svg" alt="QRWIK-POS" width={22} height={22} className="h-5.5 w-5.5" />
            <span className="font-heading text-small font-bold tracking-tight text-text">QRWIK-POS</span>
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
            className="w-full rounded-xl border border-white/85 bg-white/62 py-2 pl-9 pr-12 text-small text-text shadow-sm backdrop-blur-xl placeholder:text-text-muted/80 transition-all focus:border-primary/50 focus:bg-white/92 focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden select-none rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-text-muted md:inline-flex">
            /
          </kbd>
        </form>
      </div>

      {/* Right side: Demo Countdown, Status, Clock, Kitchen Bell, New Order CTA */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {user.isDemo && user.demoExpiresAt ? (
          <DemoTimer expiresAt={user.demoExpiresAt} onExpire={handleDemoExpired} />
        ) : null}

        <ConnectionStatus />

        <div className="hidden items-center gap-1.5 rounded-xl border border-border/80 bg-background/70 px-3 py-1.5 text-small font-medium tabular-nums text-text-muted md:flex">
          <ClockIcon className="h-4 w-4 text-primary/70" />
          <span>{clock}</span>
        </div>

        <NotificationCenter />

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

