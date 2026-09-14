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
 * Starts deterministically as "connecting" on both server and browser,
 * then synchronizes with the shared socket after mount. This avoids a
 * production hydration mismatch when the browser socket is already live.
 */
export function useSocketConnectionState(): SocketConnectionState {
  const [state, setState] = useState<SocketConnectionState>("connecting");

  useEffect(() => {
    const socket = connectSocket();
    const initialId = window.setTimeout(
      () => setState(socket.connected ? "connected" : "connecting"),
      0,
    );

    const handleConnected = () => setState("connected");
    const handleDisconnected = () => setState("connecting");

    socket.on("connect", handleConnected);
    socket.on("disconnect", handleDisconnected);
    // `reconnect_attempt`/`reconnect` live on the Manager (`socket.io`),
    // not the socket itself, in socket.io-client v4.
    socket.io.on("reconnect_attempt", handleDisconnected);
    socket.io.on("reconnect", handleConnected);

    return () => {
      window.clearTimeout(initialId);
      socket.off("connect", handleConnected);
      socket.off("disconnect", handleDisconnected);
      socket.io.off("reconnect_attempt", handleDisconnected);
      socket.io.off("reconnect", handleConnected);
    };
  }, []);

  return state;
}
