import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Every module that needs to push a real-time event imports `emitToRestaurant`
 * instead of reaching into a raw `io` instance — keeps the "who can emit
 * what" surface small and means services never need direct access to the
 * Socket.io server object.
 */
let ioInstance: SocketIOServer | null = null;

function restaurantRoom(restaurantId: string): string {
  return `restaurant:${restaurantId}`;
}

/**
 * Socket.io setup attached to the shared HTTP server. Every client
 * authenticates with the same JWT access token used for REST calls (sent
 * as `auth: { token }` on connect) and is auto-joined to its
 * `restaurant:{restaurantId}` room — the room is derived from the verified
 * token, never from a client-supplied value, matching the REST auth
 * pattern (PRD §2).
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error("Authentication required."));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.restaurantId = payload.restaurantId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired session."));
    }
  });

  io.on("connection", (socket) => {
    const restaurantId = socket.data.restaurantId as string;
    socket.join(restaurantRoom(restaurantId));
    console.log(
      `[socket] client connected: ${socket.id} (restaurant ${restaurantId})`,
    );

    socket.on("disconnect", (reason) => {
      console.log(`[socket] client disconnected: ${socket.id} (${reason})`);
    });
  });

  ioInstance = io;
  return io;
}

/**
 * Emits `event` with `payload` to every connected client (POS terminals,
 * KDS, future QR PWA) scoped to one restaurant's room. Silently no-ops if
 * the socket server hasn't initialized yet (e.g. during a script/test run
 * that never calls `initSocketServer`) — real-time sync is a UX
 * enhancement here, never a requirement for the underlying REST action to
 * succeed.
 */
export function emitToRestaurant(
  restaurantId: string,
  event: string,
  payload: unknown,
): void {
  ioInstance?.to(restaurantRoom(restaurantId)).emit(event, payload);
}
