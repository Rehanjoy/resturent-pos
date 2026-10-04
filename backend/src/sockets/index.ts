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

function roleRoom(restaurantId: string, role: string): string {
  return `role:${restaurantId}:${role}`;
}

function userRoom(restaurantId: string, userId: string): string {
  return `user:${restaurantId}:${userId}`;
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
    socket.join(roleRoom(restaurantId, socket.data.role as string));
    socket.join(userRoom(restaurantId, socket.data.userId as string));
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
  if (!ioInstance) return;
  const operationalRoles = ["owner", "manager", "cashier", "server", "chef"];
  const roles = event.startsWith("inventory:")
    ? ["owner", "manager", "inventory_manager", "chef"]
    : event.startsWith("service:")
      ? ["owner", "manager", "cashier", "server"]
      : event.startsWith("whatsapp:")
        ? ["owner", "manager"]
        : event.startsWith("order:") || event.startsWith("kitchen:") || event.startsWith("dining:") || event.startsWith("table:")
          ? operationalRoles
          : null;
  if (roles) {
    ioInstance.to(roles.map((role) => roleRoom(restaurantId, role))).emit(event, payload);
    return;
  }
  ioInstance.to(restaurantRoom(restaurantId)).emit(event, payload);
}

export function emitNotificationToAudience(restaurantId: string, roles: readonly string[], userIds: readonly string[], payload: unknown): void {
  if (!ioInstance) return;
  const rooms = [
    ...new Set(roles.map((role) => roleRoom(restaurantId, role))),
    ...new Set(userIds.map((userId) => userRoom(restaurantId, userId))),
  ];
  if (rooms.length) ioInstance.to(rooms).emit("notification:new", payload);
}
