"use client";

import { useEffect, useRef } from "react";
import { connectSocket } from "@/lib/socket";

/**
 * Single place that owns "how do we subscribe to a restaurant-scoped
 * socket event from a React component" — extracted from the hand-rolled
 * `useEffect` + `connectSocket()` + `socket.on/off` boilerplate that used
 * to be duplicated in `order-workspace.tsx`, `kds-board.tsx`, and
 * `tables-screen.tsx` (and would otherwise have been copy-pasted a fourth,
 * fifth, sixth time into `orders-overview.tsx`, `billing-workspace.tsx`,
 * `reservations-screen.tsx`). Every screen that needs a live update now
 * goes through this hook instead of touching the socket directly, so
 * there's exactly one place to fix if the subscribe/cleanup pattern ever
 * needs to change.
 *
 * The latest `handler` is always called (via a ref) without re-subscribing
 * on every render — callers can pass an inline arrow function without
 * memoizing it themselves, same ergonomics as the `useEffect` blocks this
 * replaces, minus the risk of forgetting a dependency and leaking a
 * listener across re-renders.
 *
 * `options.enabled` mirrors the `if (!canView) return;` / `if (!orderId)
 * return;` early-outs the original effects used — pass `false` to skip
 * subscribing entirely (e.g. while a role check hasn't resolved, or an id
 * this event should be scoped to isn't known yet). Whenever `enabled` (or
 * `event`) changes, the previous listener is torn down and, if still
 * enabled, a fresh one is attached — and on unmount the listener is always
 * removed, so navigating away from a screen never leaves a stale
 * subscription behind (the socket connection itself is shared/persistent
 * across the app via `lib/socket.ts` and is never disconnected here).
 */
export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  options?: { enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;

  const handlerRef = useRef(handler);
  // Keep the ref current without touching it during render (mutating a
  // ref's `.current` while rendering is itself a footgun React's lint
  // rules now flag) — this effect re-runs after every render (no deps) and
  // exists solely to sync the ref, not to (re)subscribe anything.
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    const socket = connectSocket();
    const listener = (payload: T) => handlerRef.current(payload);

    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [event, enabled]);
}
