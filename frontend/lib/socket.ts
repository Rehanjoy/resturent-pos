/**
 * Single Socket.io client for the whole app — first module that needs
 * real-time updates (Table Grid, per PRD §3.5 "real-time table-status
 * sync"). Mirrors the "one API client" rule from coding-standards.md but
 * for the WebSocket transport: every feature that needs a live event
 * connects through `getSocket()` instead of creating its own connection.
 *
 * Reuses `NEXT_PUBLIC_API_BASE_URL` as the Socket.io server origin — the
 * backend attaches Socket.io to the same HTTP server as the REST API
 * (`backend/src/server.ts`), so no separate socket URL env var is needed.
 */
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "./auth/token-store";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

let socket: Socket | null = null;

/**
 * Lazily creates (once) and returns the shared socket instance. The `auth`
 * callback re-reads the access token from the in-memory token store on
 * every (re)connection attempt, so a token refreshed after a silent
 * `/api/auth/refresh` is picked up automatically without recreating the
 * client.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: (callback) => callback({ token: getAccessToken() }),
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
  return client;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}
