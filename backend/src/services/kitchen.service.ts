import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Kot, type KotDocument } from "../models/kot.model";
import { Order } from "../models/order.model";
import { Table } from "../models/table.model";
import { emitToRestaurant } from "../sockets";
import { findOrderOrThrow, toKotDto, toOrderDto, type KotDto } from "./order.service";
import { notifyTicketReady } from "./notification.service";

async function createReadyNotification(restaurantId: string, kotId: string, order: InstanceType<typeof Order>) {
  const table = await Table.findOne({ _id: order.tableId, restaurantId }).select("name").lean();
  notifyTicketReady({
    restaurantId, kotId, orderId: order.id, diningSessionId: order.diningSessionId,
    assignedWaiterId: order.assignedWaiter?.id, tableLabel: table?.name ?? "Table", seats: order.seats,
  });
}

async function findKotOrThrow(
  restaurantId: string,
  kotId: string,
): Promise<HydratedDocument<KotDocument>> {
  if (!Types.ObjectId.isValid(kotId)) {
    throw new AppError("Ticket not found.", 404, "NOT_FOUND");
  }
  const kot = await Kot.findOne({ _id: kotId, restaurantId });
  if (!kot) {
    throw new AppError("Ticket not found.", 404, "NOT_FOUND");
  }
  return kot;
}

/**
 * Active KDS queue = every KOT not yet fully served (`servedAt` unset).
 * This deliberately still includes tickets whose items are all "ready" —
 * PRD §3.4 clears a ticket on the *Serve* action, not on Mark Ready, so a
 * ready-but-unserved ticket stays on the board (frontend renders it in a
 * distinct "ready" grouping) until a server serves it from the POS.
 */
export async function listActiveTickets(restaurantId: string): Promise<KotDto[]> {
  const kots = await Kot.find({ restaurantId, servedAt: null }).sort({ sentAt: 1 });
  return kots.map(toKotDto);
}

/**
 * Once every KOT belonging to an order has been fully marked ready (no
 * ticket left with `allReadyAt` unset), the order itself advances to
 * "ready" — this is the multi-KOT completion check described in
 * `order.service.ts`'s `sendToKitchen` doc comment.
 */
async function advanceOrderToReadyIfComplete(
  restaurantId: string,
  orderId: Types.ObjectId,
): Promise<void> {
  const outstanding = await Kot.exists({ restaurantId, orderId, allReadyAt: null });
  if (outstanding) return;

  const order = await Order.findOne({ _id: orderId, restaurantId });
  if (!order) return;
  if (order.status !== "sent" && order.status !== "in_kitchen") return;

  order.status = "ready";
  await order.save();
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });
}

/**
 * Marks a single item on a ticket ready, keeping the order's copy of that
 * item in sync. If this was the last outstanding item on the ticket, the
 * ticket itself is stamped `allReadyAt` and `kitchen:ticket-ready` fires
 * too — an item-by-item KDS workflow still reaches the same end state as
 * `markAllReady`.
 */
export async function markItemReady(
  restaurantId: string,
  kotId: string,
  orderItemId: string,
): Promise<KotDto> {
  const kot = await findKotOrThrow(restaurantId, kotId);
  const kotItem = kot.items.find((item) => item.orderItemId.toString() === orderItemId);
  if (!kotItem) {
    throw new AppError("Item not found on this ticket.", 404, "NOT_FOUND");
  }
  if (kotItem.itemStatus === "served") {
    throw new AppError("This item has already been served.", 400, "INVALID_STATE");
  }

  kotItem.itemStatus = "ready";

  const order = await findOrderOrThrow(restaurantId, kot.orderId.toString());
  if (order.cancellation || ["closed", "void", "billed"].includes(order.status)) throw new AppError("This order is no longer active.", 409, "ORDER_NOT_ACTIVE");
  const orderItem = order.items.id(orderItemId);
  if (orderItem && orderItem.itemStatus !== "served") {
    orderItem.itemStatus = "ready";
  }

  const allReady = kot.items.every((item) => item.itemStatus === "ready" || item.itemStatus === "served");
  if (allReady && !kot.allReadyAt) {
    kot.allReadyAt = new Date();
  }

  await kot.save();
  await order.save();

  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });

  const dto = toKotDto(kot);
  if (allReady) {
    emitToRestaurant(restaurantId, "kitchen:ticket-ready", { kot: dto });
    void createReadyNotification(restaurantId, kot.id, order).catch((error) => console.error("[notification] ready alert failed", error));
    await advanceOrderToReadyIfComplete(restaurantId, kot.orderId);
  }

  return dto;
}

/** Marks every item on the ticket ready in one action. */
export async function markAllReady(restaurantId: string, kotId: string): Promise<KotDto> {
  const kot = await findKotOrThrow(restaurantId, kotId);
  const order = await findOrderOrThrow(restaurantId, kot.orderId.toString());
  if (order.cancellation || ["closed", "void", "billed"].includes(order.status)) throw new AppError("This order is no longer active.", 409, "ORDER_NOT_ACTIVE");

  for (const kotItem of kot.items) {
    if (kotItem.itemStatus === "served") continue;
    kotItem.itemStatus = "ready";
    const orderItem = order.items.id(kotItem.orderItemId);
    if (orderItem && orderItem.itemStatus !== "served") {
      orderItem.itemStatus = "ready";
    }
  }
  kot.allReadyAt = new Date();

  await kot.save();
  await order.save();

  const kotDto = toKotDto(kot);
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });
  emitToRestaurant(restaurantId, "kitchen:ticket-ready", { kot: kotDto });
  void createReadyNotification(restaurantId, kot.id, order).catch((error) => console.error("[notification] ready alert failed", error));

  await advanceOrderToReadyIfComplete(restaurantId, kot.orderId);

  return kotDto;
}
