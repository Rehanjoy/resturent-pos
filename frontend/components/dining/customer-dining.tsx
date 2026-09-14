"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { ApiError } from "@/lib/api";
import { diningApi, remainingTime } from "@/lib/dining/api";
import type { CartItem, DiningContext, DiningMenuItem, DiningNotification, DiningSessionResponse, DiningCustomer } from "@/lib/dining/types";
import { SeatSelection } from "./seat-selection";
import { MenuCustomization } from "./menu-customization";
import { OrderTracker } from "./order-tracker";
import { GuestMenu } from "./guest-menu";
import { GuestCart } from "./guest-cart";
import { GuestIdentity } from "./guest-identity";
import { GuestService } from "./guest-service";
import { VisitSummary } from "./visit-summary";
import { GuestNotificationCenter } from "./guest-notification-center";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Check your connection and try again.";
}

/** Header row: restaurant identity on the left, current-step indicator on the right. */
function DiningHeader({
  context,
  view,
  setView,
  showViewToggle,
  hasActiveSession,
  notifications,
}: {
  context: DiningContext | null;
  view: "menu" | "order";
  setView: (view: "menu" | "order") => void;
  showViewToggle: boolean;
  hasActiveSession: boolean;
  notifications?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo-mark.svg" alt="" width={38} height={38} />
          <div className="min-w-0">
            <span className="block truncate font-heading text-lg font-semibold">
              {context?.restaurant.name || "Saffron"}
            </span>
            <p className="truncate text-xs text-text-muted">
              {context
                ? `${context.scanned.tableName}${context.scanned.chairNumber ? ` · scanned at chair ${context.scanned.chairNumber}` : ""}`
                : "Scan. Settle in. Enjoy."}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {notifications}
          {showViewToggle ? (
            <Tabs value={view} onValueChange={(value) => setView(value as "menu" | "order")}>
              <TabsList aria-label="Switch between the menu and your order status">
                <TabsTrigger value="menu">Menu</TabsTrigger>
                <TabsTrigger value="order">Order</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : (
            <Badge variant="outline" className="hidden sm:inline-flex">{hasActiveSession ? "Menu" : "Choose seats"}</Badge>
          )}
        </div>
      </div>
    </header>
  );
}

/** Loading state shown while the QR context (table, menu, live seat map) loads. */
function LoadingState() {
  return (
    <div role="status" className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-40 rounded-3xl" />
      <p className="text-center text-sm text-text-muted">Finding your table and available seats…</p>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-40 rounded-3xl" />)}
      </div>
    </div>
  );
}

export function CustomerDining({ qrToken }: { qrToken: string }) {
  const [context, setContext] = useState<DiningContext | null>(null);
  const [session, setSession] = useState<DiningSessionResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<DiningCustomer | null>(null);
  const [now, setNow] = useState(0);
  const clockOffset = useRef(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customize, setCustomize] = useState<DiningMenuItem | null>(null);
  const [view, setView] = useState<"menu" | "order">("menu");
  const orderKey = useRef<string | null>(null);
  const storageKey = `saffron-dining:${qrToken}`;

  const syncClock = useCallback((serverNow: string) => {
    clockOffset.current = Date.parse(serverNow) - Date.now();
    setNow(Date.now() + clockOffset.current);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    const response = await diningApi.session(qrToken, token);
    setSession(response);
    syncClock(response.serverNow);
  }, [qrToken, token, syncClock]);

  const initialize = useCallback(async () => {
    try {
      const nextContext = await diningApi.context(qrToken);
      setContext(nextContext);
      syncClock(nextContext.serverNow);

      let savedToken: string | null = null;
      try { savedToken = localStorage.getItem(storageKey); } catch { /* Session remains usable when storage is unavailable. */ }

      if (savedToken) {
        setToken(savedToken);
        try {
          const savedSession = await diningApi.session(qrToken, savedToken);
          setToken(savedToken);
          setSession(savedSession);
          setCustomer(savedSession.session.customer ?? null);
          syncClock(savedSession.serverNow);
        } catch (cause) {
          if (cause instanceof ApiError && [401, 403, 404, 410].includes(cause.status)) {
            setToken(null);
            try { localStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
          } else {
            throw cause;
          }
        }
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [qrToken, storageKey, syncClock]);

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(initializeTimer);
  }, [initialize]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const poll = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || busy) return;
      try {
        if (token) {
          const response = await diningApi.session(qrToken, token);
          if (active) { setSession(response); syncClock(response.serverNow); }
        } else {
          const response = await diningApi.context(qrToken);
          if (active) { setContext(response); syncClock(response.serverNow); }
        }
      } catch (cause) {
        if (active) setError(`Live update paused. ${message(cause)}`);
      }
    }, 5000);
    return () => { active = false; window.clearInterval(poll); };
  }, [qrToken, token, busy, syncClock]);

  const reserve: Parameters<typeof SeatSelection>[0]["onReserve"] = async (partySize, seats, bookingMode) => {
    if (!customer) return;
    setBusy(true);
    setError(null);
    try {
      const response = await diningApi.hold(qrToken, partySize, seats, customer, bookingMode);
      setToken(response.sessionToken);
      setSession({ ...response, order: null, cancellation: null });
      syncClock(response.serverNow);
      try {
        localStorage.setItem(storageKey, response.sessionToken);
      } catch {
        setError("Your seats are reserved. Keep this page open: this browser cannot save your session for refresh.");
      }
    } catch (cause) {
      setError(message(cause));
      try { setContext(await diningApi.context(qrToken)); } catch { /* Keep the original reservation error. */ }
    } finally {
      setBusy(false);
    }
  };

  async function placeOrder() {
    if (!token || !cart.length) return;
    setBusy(true);
    setError(null);
    orderKey.current ??= crypto.randomUUID();
    try {
      const response = await diningApi.order(qrToken, token, cart, orderKey.current);
      setSession(response);
      syncClock(response.serverNow);
      setCart([]);
      setCartOpen(false);
      setView("order");
      orderKey.current = null;
    } catch (cause) {
      setError(message(cause));
      try {
        await refreshSession();
        if (cause instanceof ApiError && cause.code === "MENU_ITEM_UNAVAILABLE") setContext(await diningApi.context(qrToken));
      } catch { /* Retrying uses the same key to prevent duplicate orders. */ }
    } finally {
      setBusy(false);
    }
  }

  async function quoteCancellation(items: { orderItemId: string; qty: number }[]) {
    if (!token) throw new Error("Your dining session could not be verified.");
    setBusy(true);
    setError(null);
    try {
      const response = await diningApi.cancellationQuote(qrToken, token, items);
      syncClock(response.serverNow);
      return response;
    } catch (cause) {
      setError(message(cause));
      throw cause;
    } finally {
      setBusy(false);
    }
  }

  async function cancel(reason: string, items: { orderItemId: string; qty: number; acceptedChargePercent: number }[]) {
    if (!token) return false;
    setBusy(true);
    setError(null);
    try {
      const response = await diningApi.cancelItems(qrToken, token, reason, items);
      setSession(response);
      syncClock(response.serverNow);
      return true;
    } catch (cause) {
      setError(message(cause));
      try { await refreshSession(); } catch { /* Keep original cancellation error visible. */ }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function chooseAgain() {
    setBusy(true);
    try {
      const response = await diningApi.context(qrToken);
      setContext(response);
      setToken(null);
      setSession(null);
      setCustomer(null);
      setCart([]);
      setCartOpen(false);
      setView("menu");
      orderKey.current = null;
      try { localStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  const expired =
    session?.session.status === "expired" ||
    session?.session.status === "released" ||
    (session?.session.status === "held" && Boolean(session.session.expiresAt) && now >= Date.parse(session.session.expiresAt!));

  async function retry() {
    setError(null);
    try {
      if (token) await refreshSession();
      else await initialize();
    } catch (cause) {
      setError(message(cause));
    }
  }

  function openNotificationTarget(notification: DiningNotification) {
    const isOrderActivity = ["orders", "kitchen", "billing"].includes(notification.category) ||
      ["order", "kitchen", "payment"].some((prefix) => notification.eventType.startsWith(prefix));
    if (isOrderActivity && session?.order) {
      setView("order");
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      return;
    }
    if (notification.category === "service" || notification.eventType.startsWith("service")) {
      window.requestAnimationFrame(() => {
        document.getElementById("guest-service")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  return (
    <main className="min-h-dvh bg-background text-text">
      <Toaster position="top-center" />

      <DiningHeader
        context={context}
        view={view}
        setView={setView}
        showViewToggle={Boolean(session?.order) && !expired}
        hasActiveSession={Boolean(session) && !expired}
        notifications={token ? (
          <GuestNotificationCenter
            key={token}
            qrToken={qrToken}
            sessionToken={token}
            active={!expired}
            onAction={openNotificationTarget}
          />
        ) : undefined}
      />

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {error && (
          <Alert variant="destructive" className="mx-auto mb-5 max-w-4xl">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void retry()}>Retry</Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <LoadingState />
        ) : !context ? (
          <Card className="rounded-3xl p-8 text-center">
            <h1 className="text-xl font-semibold">We couldn’t open this QR code.</h1>
            <p className="mt-2 text-text-muted">Try scanning the code again or ask your waiter for help.</p>
          </Card>
        ) : session?.order && view === "order" ? (
          <>
            <OrderTracker
              data={session}
              now={now}
              policy={session.session.policy}
              busy={busy}
              error={error}
              taxConfig={context.taxConfig}
              onAddItems={() => setView("menu")}
              onQuote={quoteCancellation}
              onCancel={cancel}
            />
            <VisitSummary data={session} now={now} />
            {token && <GuestService qrToken={qrToken} token={token} active={!expired} />}
          </>
        ) : expired ? (
          <Card className="mx-auto max-w-lg rounded-3xl p-8 text-center">
            <h1 className="font-heading text-2xl font-semibold">Your seat hold has ended</h1>
            <p className="my-4 text-sm text-text-muted">
              No order was placed before the timer ended, or staff released this booking. These seats can now be reserved by someone else.
            </p>
            <Button type="button" variant="accent" size="lg" disabled={busy} onClick={() => void chooseAgain()}>
              Choose available seats
            </Button>
          </Card>
        ) : token && !session ? (
          <Card className="mx-auto max-w-lg rounded-3xl p-8 text-center">
            <h1 className="text-xl font-semibold">Restoring your booking</h1>
            <p className="mt-3 text-sm text-text-muted">Your reservation is saved on this device. Check your connection and tap Retry to reopen it.</p>
          </Card>
        ) : !session && !customer ? (
          <GuestIdentity onContinue={setCustomer} />
        ) : !session ? (
          <SeatSelection context={context} busy={busy} onReserve={reserve} />
        ) : (
          <>
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{session.session.partySize} guests · {session.session.seats.length} chairs</p>
                  <Badge variant="outline">{session.session.bookingMode === "whole_table" ? "Whole table" : "Selected chairs"}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {session.session.seats
                    .map((seat) => `${context.tables.find((table) => table.id === seat.tableId)?.name ?? "Table"} / chair ${seat.chairNumber}`)
                    .join(" · ")}
                </p>
                {session.session.assignedWaiter?.name && (
                  <p className="mt-2 text-xs font-medium text-primary">Your waiter · {session.session.assignedWaiter.name}</p>
                )}
              </div>

              {session.session.expiresAt ? (
                <div className="rounded-2xl bg-primary/10 px-4 py-2 text-center">
                  <strong className="block text-xl tabular-nums text-primary">{remainingTime(session.session.expiresAt, now)}</strong>
                  <span className="text-[11px]">to place order</span>
                </div>
              ) : (
                <Badge variant="success" className="h-auto px-3 py-2">Seats occupied</Badge>
              )}
            </Card>

            {session.order && (
              <Card className="mb-5 flex items-center justify-between gap-4 rounded-2xl border-primary/20 bg-primary/5 p-4">
                <div>
                  <strong className="text-sm">Adding to order #{session.order.id.slice(-6).toUpperCase()}</strong>
                  <p className="mt-1 text-xs text-text-muted">New dishes go straight to the kitchen. Your current order stays active.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setView("order")}>
                  View status
                </Button>
              </Card>
            )}

            <GuestMenu context={context} cart={cart} busy={busy} onCustomize={setCustomize} onReview={() => setCartOpen(true)} />
            {token && <GuestService qrToken={qrToken} token={token} active={!expired} />}
          </>
        )}

        {session?.order && session.session.status === "released" && (
          <div className="mx-auto mt-4 max-w-2xl text-center">
            <Button type="button" variant="accent" size="lg" disabled={busy} onClick={() => void chooseAgain()}>
              Start a new visit
            </Button>
          </div>
        )}
      </div>

      {customize && !expired && (
        <MenuCustomization
          key={customize.id}
          item={customize}
          onClose={() => setCustomize(null)}
          onAdd={(item) => {
            setCart((current) => [...current, item]);
            orderKey.current = null;
            setCustomize(null);
          }}
        />
      )}

      {cartOpen && !expired && context && (
        <GuestCart
          cart={cart}
          policy={session?.session.policy ?? context.policy}
          taxConfig={context.taxConfig}
          isAdditionalOrder={Boolean(session?.order)}
          busy={busy}
          error={error}
          onClose={() => setCartOpen(false)}
          onChange={(items) => { setCart(items); orderKey.current = null; }}
          onPlace={() => void placeOrder()}
        />
      )}
    </main>
  );
}
