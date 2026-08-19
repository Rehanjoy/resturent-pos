"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export type SocketConnectionState = "connected" | "connecting";

/**
 * Tracks the shared socket's real connection lifecycle — used to drive the
 * "Live" / "Reconnecting…" indicator in `components/layout/topbar.tsx`.
 * Deliberately reads the socket's own `connect`/`disconnect` events plus
 * the underlying Manager's `reconnect`/`reconnect_attempt` events (exposed
 * via `socket.io` in socket.io-client v4) rather than assuming "mounted =
 * connected" — staff need to know when what they're looking at might be
 * stale, not just see a decorative dot that's always green.
 *
 * Starts as "connecting" (never a false-positive "connected" before the
 * handshake actually completes) and flips to "connected" immediately if
 * the shared socket instance happens to already be connected when this
 * hook mounts (e.g. a second screen mounting after the first already
 * connected it).
 */
export function useSocketConnectionState(): SocketConnectionState {
  // Lazy initializer (runs once, during this component's first render
  // only) rather than a `setState` call inside the effect body below —
  // reflects the shared socket's *current* connection state immediately
  // instead of always starting from a hardcoded "connecting" and briefly
  // flashing the amber state even when another screen already connected
  // it.
  const [state, setState] = useState<SocketConnectionState>(
    () => (connectSocket().connected ? "connected" : "connecting"),
  );

  useEffect(() => {
    const socket = connectSocket();

    const handleConnected = () => setState("connected");
    const handleDisconnected = () => setState("connecting");

    socket.on("connect", handleConnected);
    socket.on("disconnect", handleDisconnected);
    // `reconnect_attempt`/`reconnect` live on the Manager (`socket.io`),
    // not the socket itself, in socket.io-client v4.
    socket.io.on("reconnect_attempt", handleDisconnected);
    socket.io.on("reconnect", handleConnected);

    return () => {
      socket.off("connect", handleConnected);
      socket.off("disconnect", handleDisconnected);
      socket.io.off("reconnect_attempt", handleDisconnected);
      socket.io.off("reconnect", handleConnected);
    };
  }, []);

  return state;
}
