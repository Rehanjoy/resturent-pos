"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ApiError } from "@/lib/api";
import { diningApi, remainingTime } from "@/lib/dining/api";
import type { CartItem, DiningContext, DiningMenuItem, DiningSessionResponse, DiningCustomer } from "@/lib/dining/types";
import { SeatSelection } from "./seat-selection";
import { MenuCustomization } from "./menu-customization";
import { OrderTracker } from "./order-tracker";
import { GuestMenu } from "./guest-menu";
import { GuestCart } from "./guest-cart";
import { GuestIdentity } from "./guest-identity";
import { GuestService } from "./guest-service";
import { VisitSummary } from "./visit-summary";
import { OrderUpdates } from "./order-updates";

function message(error: unknown) { return error instanceof Error ? error.message : "Check your connection and try again."; }

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
  const orderKey = useRef<string | null>(null);
  const storageKey = `saffron-dining:${qrToken}`;

  const syncClock = useCallback((serverNow: string) => {
    clockOffset.current = Date.parse(serverNow) - Date.now();
    setNow(Date.now() + clockOffset.current);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) return;
    const response = await diningApi.session(qrToken, token);
    setSession(response); syncClock(response.serverNow);
  }, [qrToken, token, syncClock]);

  const initialize = useCallback(async () => {
    try {
      const nextContext = await diningApi.context(qrToken);
      setContext(nextContext); syncClock(nextContext.serverNow);
      let savedToken: string | null = null;
      try { savedToken = localStorage.getItem(storageKey); } catch { /* Session remains usable when storage is unavailable. */ }
      if (savedToken) { setToken(savedToken);
        try {
          const savedSession = await diningApi.session(qrToken, savedToken);
          setToken(savedToken); setSession(savedSession); setCustomer(savedSession.session.customer ?? null); syncClock(savedSession.serverNow);
        } catch (cause) {
          if (cause instanceof ApiError && [401, 403, 404, 410].includes(cause.status)) {
            setToken(null); try { localStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
          } else throw cause;
        }
      }
    } catch (cause) { setError(message(cause)); }
    finally { setLoading(false); }
  }, [qrToken, storageKey, syncClock]);

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(initializeTimer);
  }, [initialize]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now() + clockOffset.current), 1000); return () => window.clearInterval(timer); }, []);
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
      } catch (cause) { if (active) setError(`Live update paused. ${message(cause)}`); }
    }, 5000);
    return () => { active = false; window.clearInterval(poll); };
  }, [qrToken, token, busy, syncClock]);

  const reserve: Parameters<typeof SeatSelection>[0]["onReserve"] = async (partySize, seats) => {
    if (!customer) return;
    setBusy(true); setError(null);
    try {
      const response = await diningApi.hold(qrToken, partySize, seats, customer);
      setToken(response.sessionToken); setSession({ ...response, order: null, cancellation: null }); syncClock(response.serverNow);
      try { localStorage.setItem(storageKey, response.sessionToken); } catch { setError("Your seats are reserved. Keep this page open: this browser cannot save your session for refresh."); }
    } catch (cause) {
      setError(message(cause));
      try { setContext(await diningApi.context(qrToken)); } catch { /* Keep the original reservation error. */ }
    } finally { setBusy(false); }
  };

  async function placeOrder() {
    if (!token || !cart.length) return;
    setBusy(true); setError(null);
    orderKey.current ??= crypto.randomUUID();
    try {
      const response = await diningApi.order(qrToken, token, cart, orderKey.current);
      setSession(response); syncClock(response.serverNow); setCart([]); setCartOpen(false);
    } catch (cause) {
      setError(message(cause));
      try { await refreshSession(); if (cause instanceof ApiError && cause.code === "MENU_ITEM_UNAVAILABLE") setContext(await diningApi.context(qrToken)); } catch { /* Retrying uses the same key to prevent duplicate orders. */ }
    } finally { setBusy(false); }
  }

  async function cancel(reason: string, chargePercent: number) {
    if (!token) return false;
    setBusy(true); setError(null);
    try {
      const response = await diningApi.cancel(qrToken, token, reason, chargePercent);
      setSession(response); syncClock(response.serverNow); return true;
    } catch (cause) {
      setError(message(cause));
      try { await refreshSession(); } catch { /* Keep original cancellation error visible. */ }
      return false;
    } finally { setBusy(false); }
  }

  async function chooseAgain() {
    setBusy(true);
    try {
      const response = await diningApi.context(qrToken);
      setContext(response); setToken(null); setSession(null); setCustomer(null); setCart([]); setCartOpen(false); orderKey.current = null;
      setToken(null); try { localStorage.removeItem(storageKey); } catch { /* Storage unavailable. */ }
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  const expired = session?.session.status === "expired" || session?.session.status === "released" || (session?.session.status === "held" && Boolean(session.session.expiresAt) && now >= Date.parse(session.session.expiresAt!));

  return <main className="min-h-dvh bg-background text-text">
    <header className="border-b border-border/60 bg-surface"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><Image src="/logo-mark.svg" alt="" width={34} height={34} /><div><span className="font-heading text-lg font-semibold">{context?.restaurant.name || "Saffron"}</span><p className="text-xs text-text-muted">{context ? `${context.scanned.tableName}${context.scanned.chairNumber ? ` · Chair ${context.scanned.chairNumber}` : ""}` : "Scan. Settle in. Enjoy."}</p></div></div><span className="rounded-full bg-background px-3 py-2 text-xs font-semibold">{session?.order ? "Your order" : session && !expired ? "Menu" : "Choose seats"}</span></div></header>
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      {error && <div role="alert" className="mx-auto mb-5 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-error/20 bg-surface p-4 text-sm"><span className="text-error">{error}</span><button type="button" onClick={async () => { setError(null); try { if (token) await refreshSession(); else await initialize(); } catch (cause) { setError(message(cause)); } }} className="min-h-11 rounded-full border border-border px-4 font-semibold">Retry</button></div>}
      {loading ? <div role="status" className="mx-auto max-w-3xl space-y-4"><div className="h-40 animate-pulse rounded-3xl bg-surface" /><p className="text-center text-sm text-text-muted">Finding your table and available seats…</p><div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map((key) => <div key={key} className="h-40 animate-pulse rounded-3xl bg-surface" />)}</div></div> : !context ? <div className="rounded-3xl bg-surface p-8 text-center"><h1 className="text-xl font-semibold">We couldn’t open this QR code.</h1><p className="mt-2 text-text-muted">Try scanning the code again or ask your waiter for help.</p></div> : session?.order ? <><OrderUpdates order={session.order} /><OrderTracker data={session} now={now} policy={session.session.policy} busy={busy} error={error} onQuote={async () => { setBusy(true); try { await refreshSession(); } catch (cause) { setError(message(cause)); throw cause; } finally { setBusy(false); } }} onCancel={cancel} /><VisitSummary data={session} now={now} />{token && <GuestService qrToken={qrToken} token={token} active={!expired} />}</> : expired ? <section className="mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center"><h1 className="font-heading text-2xl font-semibold">Your seat hold has ended</h1><p className="my-4 text-sm text-text-muted">No order was placed before the timer ended, or staff released this booking. These seats can now be reserved by someone else.</p><button type="button" disabled={busy} onClick={() => void chooseAgain()} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-white">Choose available seats</button></section> : token && !session ? <div className="mx-auto max-w-lg rounded-3xl bg-surface p-8 text-center"><h1 className="text-xl font-semibold">Restoring your booking</h1><p className="mt-3 text-sm text-text-muted">Your reservation is saved on this device. Check your connection and tap Retry to reopen it.</p></div> : !session && !customer ? <GuestIdentity onContinue={setCustomer} /> : !session ? <SeatSelection context={context} busy={busy} onReserve={reserve} /> : <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4"><div><p className="font-semibold">{session.session.partySize} guests · {session.session.seats.length} chairs reserved</p><p className="mt-1 text-xs text-text-muted">{session.session.seats.map((seat) => `${context.tables.find((table) => table.id === seat.tableId)?.name ?? "Table"} / ${seat.chairNumber}`).join(" · ")}</p></div>{session.session.expiresAt ? <div className="rounded-xl bg-primary/10 px-4 py-2 text-center"><strong className="block text-xl tabular-nums text-primary">{remainingTime(session.session.expiresAt, now)}</strong><span className="text-[11px]">left to place your order</span></div> : <span className="text-sm font-semibold text-success">Seats occupied · no timer</span>}</div>
        <GuestMenu context={context} cart={cart} busy={busy} onCustomize={setCustomize} onReview={() => setCartOpen(true)} />
        {token && <GuestService qrToken={qrToken} token={token} active={!expired} />}
      </>}
      {session?.order && session.session.status === "released" && <div className="mx-auto mt-4 max-w-2xl text-center"><button type="button" disabled={busy} onClick={() => void chooseAgain()} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-white">Start a new visit</button></div>}
    </div>
    {customize && !expired && !session?.order && <MenuCustomization key={customize.id} item={customize} onClose={() => setCustomize(null)} onAdd={(item) => { setCart((current) => [...current, item]); orderKey.current = null; setCustomize(null); }} />}
    {cartOpen && !expired && !session?.order && context && <GuestCart cart={cart} policy={session?.session.policy ?? context.policy} busy={busy} error={error} onClose={() => setCartOpen(false)} onChange={(items) => { setCart(items); orderKey.current = null; }} onPlace={() => void placeOrder()} />}
  </main>;
}
