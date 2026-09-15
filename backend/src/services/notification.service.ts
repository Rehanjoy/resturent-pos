import { Types } from "mongoose";
import { createHash } from "crypto";
import {
  Notification,
  type NotificationCategory,
  type NotificationDocument,
  type NotificationPriority,
} from "../models/notification.model";
import { User, resolveVisibleModules, type StaffModule, type UserRole } from "../models/user.model";
import { emitNotificationToAudience } from "../sockets";
import { AppError } from "../utils/app-error";

export interface CreateNotificationInput {
  restaurantId: string;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  priority?: NotificationPriority;
  requiredModule?: StaffModule;
  targetRoles?: UserRole[];
  targetUserIds?: string[];
  targetDiningSessionId?: string;
  entity?: { type: string; id: string };
  actionUrl?: string;
  context?: { tableLabel?: string; chairLabel?: string };
  dedupeKey: string;
}

function toDto(record: NotificationDocument, read: boolean) {
  return {
    id: record._id.toString(),
    category: record.category,
    eventType: record.eventType,
    title: record.title,
    message: record.message,
    priority: record.priority,
    actionUrl: record.actionUrl ?? null,
    entity: record.entity ?? null,
    context: record.context ?? null,
    createdAt: record.createdAt.toISOString(),
    read,
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  // A fresh process can receive concurrent events before Mongoose finishes
  // building indexes. Waiting on the model's shared init promise makes the
  // database dedupe guarantee active before the first notification write.
  await Notification.init();
  const targetUserIds = (input.targetUserIds ?? []).filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
  let record: NotificationDocument;
  try {
    record = await Notification.create({
      ...input,
      restaurantId: new Types.ObjectId(input.restaurantId),
      priority: input.priority ?? "info",
      targetRoles: input.targetRoles ?? [],
      targetUserIds,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return;
    throw error;
  }

  const wakeup = { notificationId: record._id.toString(), createdAt: record.createdAt.toISOString() };
  emitNotificationToAudience(input.restaurantId, record.targetRoles, record.targetUserIds.map(String), wakeup);
}

export function queueNotification(input: CreateNotificationInput): void {
  void createNotification(input).catch((error) => {
    console.error("[notification] could not persist notification", error);
  });
}

function seatLabel(seats?: { chairNumber: number }[]): string | undefined {
  if (!seats?.length) return undefined;
  if (seats.length === 1) return `Chair ${seats[0]!.chairNumber}`;
  if (seats.length > 6) return `${seats.length} chairs`;
  return `Chairs ${seats.map((seat) => seat.chairNumber).join(", ")}`;
}

export function notifyOrderBatch(input: { restaurantId: string; orderId: string; batchKey: string; diningSessionId?: string; assignedWaiterId?: string; tableLabel: string; seats?: { chairNumber: number }[]; itemCount: number }) {
  const context = { tableLabel: input.tableLabel, chairLabel: seatLabel(input.seats) };
  queueNotification({
    restaurantId: input.restaurantId, category: "kitchen", eventType: "order_placed",
    title: "New order for kitchen", message: `${input.tableLabel} · ${input.itemCount} item${input.itemCount === 1 ? "" : "s"} waiting to prepare.`,
    priority: "action", requiredModule: "kitchen", targetRoles: ["owner", "manager", "chef"],
    targetUserIds: input.assignedWaiterId ? [input.assignedWaiterId] : [],
    entity: { type: "order", id: input.orderId }, actionUrl: "/admin/kitchen", context,
    dedupeKey: `order:${input.orderId}:batch:${input.batchKey}:staff`,
  });
  if (input.diningSessionId) queueNotification({
    restaurantId: input.restaurantId, category: "orders", eventType: "order_received",
    title: "Order received", message: `Kitchen received ${input.itemCount} item${input.itemCount === 1 ? "" : "s"}. Preparation will start shortly.`,
    priority: "info", targetDiningSessionId: input.diningSessionId,
    entity: { type: "order", id: input.orderId }, context,
    dedupeKey: `order:${input.orderId}:batch:${input.batchKey}:guest`,
  });
}

export function notifyTicketReady(input: { restaurantId: string; orderId: string; kotId: string; diningSessionId?: string; assignedWaiterId?: string; tableLabel: string; seats?: { chairNumber: number }[] }) {
  const context = { tableLabel: input.tableLabel, chairLabel: seatLabel(input.seats) };
  queueNotification({
    restaurantId: input.restaurantId, category: "kitchen", eventType: "order_ready",
    title: `${input.tableLabel} is ready to serve`, message: `${context.chairLabel ? `${context.chairLabel} · ` : ""}Collect the prepared items from kitchen.`,
    priority: "urgent", requiredModule: "orders", targetRoles: ["owner", "manager", "cashier", "server"],
    targetUserIds: input.assignedWaiterId ? [input.assignedWaiterId] : [], entity: { type: "order", id: input.orderId },
    actionUrl: "/admin/orders/active", context, dedupeKey: `kot:${input.kotId}:ready:staff`,
  });
  if (input.diningSessionId) queueNotification({
    restaurantId: input.restaurantId, category: "orders", eventType: "order_ready",
    title: "Your order is ready", message: "Your waiter has been notified and will bring it to your table.",
    priority: "action", targetDiningSessionId: input.diningSessionId, entity: { type: "order", id: input.orderId },
    context, dedupeKey: `kot:${input.kotId}:ready:guest`,
  });
}

function servedItemsSummary(items: { name: string; qty: number }[]) {
  const shown = items.slice(0, 4);
  const remaining = items.length - shown.length;
  const list = shown.map((item) => `${item.qty}× ${item.name}`).join(", ");
  return remaining > 0 ? `${list} +${remaining} more` : list;
}

export function notifyOrderServed(input: { restaurantId: string; orderId: string; serveKey: string; diningSessionId?: string; tableLabel: string; seats?: { chairNumber: number }[]; items: { name: string; qty: number }[]; itemCount: number; allServed: boolean }) {
  const context = { tableLabel: input.tableLabel, chairLabel: seatLabel(input.seats) };
  const servedBatch = createHash("sha256").update(input.serveKey).digest("hex").slice(0, 16);
  queueNotification({
    restaurantId: input.restaurantId, category: "orders", eventType: "order_served", title: input.allServed ? `${input.tableLabel} order served` : `${input.itemCount} item${input.itemCount === 1 ? "" : "s"} served · ${input.tableLabel}`,
    message: `${context.chairLabel ? `${context.chairLabel} · ` : ""}${input.allServed ? "The complete order was marked served." : "Ready items were delivered; remaining items stay visible."}`, priority: "info",
    requiredModule: "orders", targetRoles: ["owner", "manager", "cashier", "server"], entity: { type: "order", id: input.orderId },
    actionUrl: "/admin/orders/active", context, dedupeKey: `order:${input.orderId}:served:${servedBatch}:staff`,
  });
  if (input.diningSessionId) {
    const summary = servedItemsSummary(input.items);
    const guestMessage = input.allServed
      ? `${summary} served. Your order is complete — open the menu to add more items.`
      : `${summary} served. Remaining items stay on the live tracker.`;
    queueNotification({
      restaurantId: input.restaurantId, category: "orders", eventType: "order_served", title: input.allServed ? "Order served" : `${input.itemCount} item${input.itemCount === 1 ? "" : "s"} served`,
      message: guestMessage.slice(0, 320), priority: "info",
      targetDiningSessionId: input.diningSessionId, entity: { type: "order", id: input.orderId }, context,
      dedupeKey: `order:${input.orderId}:served:${servedBatch}:guest`,
    });
  }
}

export function notifyServiceRequest(input: { restaurantId: string; requestId: string; sessionId: string; type: "water" | "bill" | "help"; status: "pending" | "acknowledged" | "completed"; assignedWaiterId?: string; tableLabel: string; seats?: { chairNumber: number }[] }) {
  const labels = { water: "Water request", bill: "Bill request", help: "Guest needs help" } as const;
  const context = { tableLabel: input.tableLabel, chairLabel: seatLabel(input.seats) };
  if (input.status === "pending") queueNotification({
    restaurantId: input.restaurantId, category: "service", eventType: `service_${input.type}_requested`, title: `${labels[input.type]} · ${input.tableLabel}`,
    message: `${context.chairLabel ? `${context.chairLabel} · ` : ""}Acknowledge the request so the guest knows staff are coming.`,
    priority: "urgent", requiredModule: "tables", targetRoles: ["owner", "manager", "cashier", "server"],
    targetUserIds: input.assignedWaiterId ? [input.assignedWaiterId] : [], entity: { type: "service_request", id: input.requestId },
    actionUrl: "/admin/tables", context, dedupeKey: `service:${input.requestId}:pending:staff`,
  });
  const guestText = input.status === "pending" ? "Your request was sent to the floor team." : input.status === "acknowledged" ? "A team member acknowledged your request and is on the way." : "Your request was completed.";
  queueNotification({
    restaurantId: input.restaurantId, category: "service", eventType: `service_${input.type}_${input.status}`,
    title: input.status === "pending" ? `${labels[input.type]} sent` : input.status === "acknowledged" ? "Staff are on the way" : `${labels[input.type]} completed`,
    message: guestText, priority: input.status === "acknowledged" ? "action" : "info", targetDiningSessionId: input.sessionId,
    entity: { type: "service_request", id: input.requestId }, context, dedupeKey: `service:${input.requestId}:${input.status}:guest`,
  });
}

export function notifyPaymentCompleted(input: { restaurantId: string; invoiceId: string; orderId: string; diningSessionId?: string; tableLabel: string; seats?: { chairNumber: number }[] }) {
  const context = { tableLabel: input.tableLabel, chairLabel: seatLabel(input.seats) };
  queueNotification({
    restaurantId: input.restaurantId, category: "billing", eventType: "payment_completed", title: `Payment complete · ${input.tableLabel}`,
    message: `${context.chairLabel ? `${context.chairLabel} · ` : ""}Seats are waiting for cleaning before they become available.`, priority: "required",
    requiredModule: "tables", targetRoles: ["owner", "manager", "cashier", "server"], entity: { type: "invoice", id: input.invoiceId },
    actionUrl: "/admin/tables", context, dedupeKey: `invoice:${input.invoiceId}:paid:staff`,
  });
  if (input.diningSessionId) queueNotification({
    restaurantId: input.restaurantId, category: "billing", eventType: "payment_completed", title: "Payment complete",
    message: "Payment was recorded successfully. Thank you for dining with us.", priority: "info", targetDiningSessionId: input.diningSessionId,
    entity: { type: "invoice", id: input.invoiceId }, context, dedupeKey: `invoice:${input.invoiceId}:paid:guest`,
  });
}

async function staffAudience(restaurantId: string, userId: string, role: UserRole) {
  const user = await User.findOne({ _id: userId, restaurantId, isActive: true }).select("role visibleModules").lean();
  if (!user) throw new AppError("Staff account is no longer active.", 403, "FORBIDDEN");
  const modules = resolveVisibleModules(user.role, user.visibleModules);
  return {
    restaurantId: new Types.ObjectId(restaurantId),
    $and: [
      { $or: [{ targetUserIds: new Types.ObjectId(userId) }, { targetRoles: role }] },
      { $or: [{ requiredModule: { $exists: false } }, { requiredModule: { $in: modules } }] },
    ],
  };
}

export async function listStaffNotifications(restaurantId: string, userId: string, role: UserRole, input: { limit: number; cursor?: string; category?: NotificationCategory; unread?: boolean }) {
  const audience = await staffAudience(restaurantId, userId, role);
  const filter: Record<string, unknown> = { ...audience };
  if (input.cursor) filter._id = { $lt: new Types.ObjectId(input.cursor) };
  if (input.category) filter.category = input.category;
  if (input.unread) filter.readByStaffIds = { $ne: new Types.ObjectId(userId) };
  const records = await Notification.find(filter).sort({ _id: -1 }).limit(input.limit + 1);
  const page = records.slice(0, input.limit);
  const unreadCount = await Notification.countDocuments({ ...audience, readByStaffIds: { $ne: new Types.ObjectId(userId) } });
  return {
    notifications: page.map((record) => toDto(record, record.readByStaffIds.some((id) => id.toString() === userId))),
    nextCursor: records.length > input.limit ? page.at(-1)!._id.toString() : null,
    unreadCount,
  };
}

export async function staffUnreadCounts(restaurantId: string, userId: string, role: UserRole) {
  const audience = await staffAudience(restaurantId, userId, role);
  const rows = await Notification.aggregate<{ _id: NotificationCategory; count: number }>([
    { $match: { ...audience, readByStaffIds: { $ne: new Types.ObjectId(userId) } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  const byCategory = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  return { total: rows.reduce((sum, row) => sum + row.count, 0), byCategory };
}

export async function markStaffNotificationRead(restaurantId: string, userId: string, role: UserRole, id: string) {
  const audience = await staffAudience(restaurantId, userId, role);
  const record = await Notification.findOneAndUpdate({ _id: id, ...audience }, { $addToSet: { readByStaffIds: new Types.ObjectId(userId) } }, { new: true });
  if (!record) throw new AppError("Notification not found.", 404, "NOT_FOUND");
  return { notification: toDto(record, true) };
}

export async function markAllStaffNotificationsRead(restaurantId: string, userId: string, role: UserRole) {
  const audience = await staffAudience(restaurantId, userId, role);
  const result = await Notification.updateMany({ ...audience, readByStaffIds: { $ne: new Types.ObjectId(userId) } }, { $addToSet: { readByStaffIds: new Types.ObjectId(userId) } });
  return { updated: result.modifiedCount };
}

export async function listGuestNotifications(restaurantId: string, sessionId: string, input: { limit: number; cursor?: string }) {
  const filter: Record<string, unknown> = { restaurantId: new Types.ObjectId(restaurantId), targetDiningSessionId: sessionId };
  if (input.cursor) filter._id = { $lt: new Types.ObjectId(input.cursor) };
  const records = await Notification.find(filter).sort({ _id: -1 }).limit(input.limit + 1);
  const page = records.slice(0, input.limit);
  const unreadCount = await Notification.countDocuments({ restaurantId, targetDiningSessionId: sessionId, guestReadAt: { $exists: false } });
  return { notifications: page.map((record) => toDto(record, !!record.guestReadAt)), nextCursor: records.length > input.limit ? page.at(-1)!._id.toString() : null, unreadCount };
}

export async function markGuestNotificationRead(restaurantId: string, sessionId: string, id: string) {
  const record = await Notification.findOneAndUpdate({ _id: id, restaurantId, targetDiningSessionId: sessionId }, { $set: { guestReadAt: new Date() } }, { new: true });
  if (!record) throw new AppError("Notification not found.", 404, "NOT_FOUND");
  return { notification: toDto(record, true) };
}
