import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { MenuItem } from "../models/menu-item.model";
import type { SpiceLevel } from "../models/menu-item.model";
import { Table } from "../models/table.model";
import {
  Order,
  type OrderDocument,
  type OrderItemStatus,
  type OrderStatus,
} from "../models/order.model";
import { Kot, type KotDocument } from "../models/kot.model";
import { emitToRestaurant } from "../sockets";
import { recordAuditLog } from "./audit-log.service";
import * as tableService from "./table.service";
import { deductInventoryForSentItems } from "./inventory-deduction.service";
import { DiningFloor } from "../models/dining-floor.model";
import { notifyOrderBatch, notifyOrderServed } from "./notification.service";

export interface OrderItemDto {
  id: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  cancelledQty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  sentAt?: Date;
  estimatedReadyAt?: Date;
}

export interface OrderDto {
  id: string;
  restaurantId: string;
  tableId: string;
  status: OrderStatus;
  items: OrderItemDto[];
  /** Sum of `priceSnapshot * qty` across all items, integer paise. Tax,
   * discount, and total are owned by the Billing module (next part) —
   * deliberately not computed here. */
  subtotal: number;
  createdByStaffId: string;
  source?: string;
  diningSessionId?: string;
  assignedWaiter?: OrderDocument["assignedWaiter"];
  seats?: OrderDocument["seats"];
  placedAt?: Date;
  cancellation?: OrderDocument["cancellation"];
  cancellations?: OrderDocument["cancellations"];
  customerTotal?: number;
  servedByStaffId?: string;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KotItemDto {
  orderItemId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  cancelledQty: number;
  spiceLevel?: SpiceLevel;
  addOns: string[];
  notes?: string;
  itemStatus: OrderItemStatus;
  estimatedReadyAt?: Date;
}

export interface KotDto {
  id: string;
  restaurantId: string;
  orderId: string;
  tableId: string;
  items: KotItemDto[];
  sentAt: Date;
  allReadyAt?: Date;
  servedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Order statuses in which the order can still accept new pending items or
// edits/removals of not-yet-sent items ("split order support ... add more
// later to same table session", PRD §3.3). Deliberately excludes
// billed/closed/void — once billing has started, or the order is void,
// nothing about its items should change through this module again. Note
// this intentionally includes "served": a server adding a dessert after
// mains have gone out is still "the same table session".
const EDITABLE_STATUSES: OrderStatus[] = ["draft", "sent", "in_kitchen", "ready", "served"];

// Statuses that count as "this table already has a live order" — used to
// avoid creating a duplicate draft, and to decide whether a void should
// free the table back up. Exported so other modules that need to know "is
// this table actively in use by an order" (e.g. `reservation.service.ts`'s
// table-hold logic) check against the same single source of truth instead
// of redefining their own list.
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["draft", "sent", "in_kitchen", "ready", "served"];

export function toOrderDto(order: HydratedDocument<OrderDocument>): OrderDto {
  const items = order.items.map((item) => ({
    id: item._id.toString(),
    menuItemId: item.menuItemId.toString(),
    nameSnapshot: item.nameSnapshot,
    priceSnapshot: item.priceSnapshot,
    qty: item.qty,
    cancelledQty: item.cancelledQty ?? 0,
    spiceLevel: item.spiceLevel,
    addOns: item.addOns,
    notes: item.notes,
    itemStatus: item.itemStatus,
    sentAt: item.sentAt,
    estimatedReadyAt: item.estimatedReadyAt,
  }));

  return {
    id: order._id.toString(),
    restaurantId: order.restaurantId.toString(),
    tableId: order.tableId.toString(),
    status: order.status,
    items,
    subtotal: items.reduce((sum, item) => sum + item.priceSnapshot * (item.qty - item.cancelledQty), 0),
    createdByStaffId: order.createdByStaffId?.toString() ?? "",
    source: order.source,
    diningSessionId: order.diningSessionId,
    assignedWaiter: order.assignedWaiter,
    seats: order.seats,
    placedAt: order.placedAt,
    cancellation: order.cancellation,
    cancellations: order.cancellations ?? [],
    customerTotal: order.customerTotal,
    servedByStaffId: order.servedByStaffId?.toString(),
    voidReason: order.voidReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function toKotDto(kot: HydratedDocument<KotDocument>): KotDto {
  return {
    id: kot._id.toString(),
    restaurantId: kot.restaurantId.toString(),
    orderId: kot.orderId.toString(),
    tableId: kot.tableId.toString(),
    items: kot.items.map((item) => ({
      orderItemId: item.orderItemId.toString(),
      menuItemId: item.menuItemId.toString(),
      nameSnapshot: item.nameSnapshot,
      priceSnapshot: item.priceSnapshot,
      qty: item.qty,
      cancelledQty: item.cancelledQty ?? 0,
      spiceLevel: item.spiceLevel,
      addOns: item.addOns,
      notes: item.notes,
      itemStatus: item.itemStatus,
      estimatedReadyAt: item.estimatedReadyAt,
    })),
    sentAt: kot.sentAt,
    allReadyAt: kot.allReadyAt,
    servedAt: kot.servedAt,
    createdAt: kot.createdAt,
    updatedAt: kot.updatedAt,
  };
}

export async function findOrderOrThrow(
  restaurantId: string,
  orderId: string,
): Promise<HydratedDocument<OrderDocument>> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError("Order not found.", 404, "NOT_FOUND");
  }
  const order = await Order.findOne({ _id: orderId, restaurantId });
  if (!order) {
    throw new AppError("Order not found.", 404, "NOT_FOUND");
  }
  return order;
}

function assertEditable(order: HydratedDocument<OrderDocument>): void {
  if (order.cancellation) throw new AppError("Cancelled orders cannot be edited.", 409, "ORDER_CANCELLED");
  if (!EDITABLE_STATUSES.includes(order.status)) {
    throw new AppError("This order can no longer be edited.", 400, "ORDER_NOT_EDITABLE");
  }
}

export async function listOrders(
  restaurantId: string,
  filters: { status?: OrderStatus; tableId?: string; from?: string; to?: string },
): Promise<OrderDto[]> {
  const query: Record<string, unknown> = { restaurantId };
  if (filters.status) query.status = filters.status;
  if (filters.tableId) query.tableId = filters.tableId;
  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(filters.to);
    query.createdAt = createdAt;
  }

  const orders = await Order.find(query).sort({ createdAt: -1 });
  return orders.map(toOrderDto);
}

export async function getOrder(restaurantId: string, orderId: string): Promise<OrderDto> {
  const order = await findOrderOrThrow(restaurantId, orderId);
  return toOrderDto(order);
}

/**
 * Creates the draft order for a table. If the table isn't free, this
 * doesn't error outright — it looks for that table's existing live order
 * and returns it instead (`created: false`). This covers the New Order
 * screen calling this endpoint unconditionally on mount, including when a
 * staff member navigates back to a table whose draft/sent/in-progress
 * order already exists.
 */
export async function createOrder(
  restaurantId: string,
  staffId: string,
  tableId: string,
): Promise<{ order: OrderDto; created: boolean }> {
  if (!Types.ObjectId.isValid(tableId)) {
    throw new AppError("Table not found.", 404, "TABLE_NOT_FOUND");
  }
  const table = await Table.findOne({ _id: tableId, restaurantId });
  if (!table) {
    throw new AppError("Table not found.", 404, "TABLE_NOT_FOUND");
  }

  const floor = await DiningFloor.findOne({ restaurantId }).lean();
  const chairSession = floor?.sessions.some(s =>
    (s.status === "occupied" || (s.status === "held" && (!s.expiresAt || Date.parse(s.expiresAt) > Date.now()))) && s.seats.some(seat => seat.tableId === tableId));
  if (chairSession) throw new AppError("This table has separate dining parties. Open the party's order from Seating.", 409, "CHAIR_SESSION_ACTIVE");

  if (table.status !== "free") {
    const existing = await Order.findOne({
      restaurantId,
      tableId,
      status: { $in: ACTIVE_ORDER_STATUSES },
    }).sort({ createdAt: -1 });
    if (existing) {
      return { order: toOrderDto(existing), created: false };
    }
    throw new AppError("This table is not free.", 409, "TABLE_NOT_FREE");
  }

  // Claim the table in the same seating aggregate used by chair holds before
  // creating a draft; concurrent QR scans cannot overtake this claim.
  await tableService.updateTableStatus(restaurantId, tableId, "occupied", true);
  const order = await Order.create({
    restaurantId,
    tableId,
    status: "draft",
    items: [],
    createdByStaffId: staffId,
  });

  // Reuses the existing table-status service so the table grid's socket
  // subscription (`table:status-changed`) picks this up for free — no
  // duplicate table-status-change logic here.

  const dto = toOrderDto(order);
  emitToRestaurant(restaurantId, "order:created", { order: dto });
  return { order: dto, created: true };
}

export interface AddOrderItemInput {
  menuItemId: string;
  qty: number;
  spiceLevel?: SpiceLevel;
  addOns?: string[];
  notes?: string;
}

export interface UpdateOrderItemInput {
  itemId: string;
  qty?: number;
  spiceLevel?: SpiceLevel;
  addOns?: string[];
  notes?: string;
}

export interface EditOrderItemsInput {
  addItems?: AddOrderItemInput[];
  updateItems?: UpdateOrderItemInput[];
  removeItemIds?: string[];
}

/**
 * Adds new items (always entering as "pending"), edits, and/or removes
 * items on an order. Editing/removing is only allowed for items still
 * "pending" — once an item has been sent to the kitchen, changing it here
 * would silently desync the KOT the kitchen is already looking at; that
 * class of change belongs to the void-with-reason flow instead (PRD §3.3
 * "order edit/cancel with mandatory reason logging ... if item already
 * sent to kitchen").
 */
export async function editOrderItems(
  restaurantId: string,
  orderId: string,
  input: EditOrderItemsInput,
): Promise<OrderDto> {
  const order = await findOrderOrThrow(restaurantId, orderId);
  assertEditable(order);
  if (order.source === "qr") throw new AppError("This guest confirmed a fixed order and cancellation quote. Place additional items as a separate staff order.", 409, "CUSTOMER_ORDER_FIXED");

  for (const removeId of input.removeItemIds ?? []) {
    const item = order.items.id(removeId);
    if (!item) {
      throw new AppError("Item not found on this order.", 404, "NOT_FOUND");
    }
    if (item.itemStatus !== "pending") {
      throw new AppError(
        "Only items that haven't been sent to the kitchen can be removed.",
        400,
        "ITEM_ALREADY_SENT",
      );
    }
    item.deleteOne();
  }

  for (const update of input.updateItems ?? []) {
    const item = order.items.id(update.itemId);
    if (!item) {
      throw new AppError("Item not found on this order.", 404, "NOT_FOUND");
    }
    if (item.itemStatus !== "pending") {
      throw new AppError(
        "Only items that haven't been sent to the kitchen can be edited.",
        400,
        "ITEM_ALREADY_SENT",
      );
    }
    if (update.qty !== undefined) item.qty = update.qty;
    if (update.spiceLevel !== undefined) item.spiceLevel = update.spiceLevel;
    if (update.addOns !== undefined) item.addOns = update.addOns;
    if (update.notes !== undefined) item.notes = update.notes;
  }

  for (const add of input.addItems ?? []) {
    if (!Types.ObjectId.isValid(add.menuItemId)) {
      throw new AppError("Selected dish does not exist.", 400, "MENU_ITEM_NOT_FOUND");
    }
    const menuItem = await MenuItem.findOne({ _id: add.menuItemId, restaurantId });
    if (!menuItem) {
      throw new AppError("Selected dish does not exist.", 400, "MENU_ITEM_NOT_FOUND");
    }
    if (!menuItem.isAvailable) {
      throw new AppError(
        `"${menuItem.name}" is not available right now.`,
        400,
        "MENU_ITEM_UNAVAILABLE",
      );
    }

    order.items.push({
      menuItemId: menuItem._id,
      nameSnapshot: menuItem.name,
      priceSnapshot: menuItem.price,
      qty: add.qty,
      spiceLevel: add.spiceLevel,
      addOns: add.addOns ?? [],
      notes: add.notes,
      itemStatus: "pending",
    });
  }

  await order.save();

  const dto = toOrderDto(order);
  emitToRestaurant(restaurantId, "order:updated", { order: dto });
  return dto;
}

/**
 * Batches every currently-`pending` item into a new KOT and sends it to
 * the kitchen.
 *
 * Order-status state machine (multiple KOTs per order):
 * - `draft -> sent`: the very first "send to kitchen" for this order.
 * - `sent | ready | served -> in_kitchen`: any later batch, sent while at
 *   least one KOT already exists for this order. This models "the kitchen
 *   is actively engaged with this table" regardless of where the earlier
 *   batch is in its own ready/served lifecycle — e.g. a dessert item added
 *   and sent after the mains were already served re-opens the order into
 *   `in_kitchen`.
 * - `in_kitchen -> ready`: handled in `kitchen.service.ts` once every KOT
 *   for the order has been fully marked ready.
 * - `ready | in_kitchen -> served`: handled by `serveOrder` below, once
 *   every item on the order has been served.
 */
export async function sendToKitchen(
  restaurantId: string,
  orderId: string,
): Promise<{ order: OrderDto; kot: KotDto }> {
  const order = await findOrderOrThrow(restaurantId, orderId);
  assertEditable(order);

  const pendingItems = order.items.filter((item) => item.itemStatus === "pending");
  if (pendingItems.length === 0) {
    throw new AppError("There are no new items to send to the kitchen.", 400, "NOTHING_TO_SEND");
  }

  // Captured before the map below flips `itemStatus` — see
  // `inventory-deduction.service.ts` for the full write-up of why
  // deduction is wired at this exact point in the order lifecycle.
  const itemsForDeduction = pendingItems.map((item) => ({
    menuItemId: item.menuItemId.toString(),
    qty: item.qty,
  }));

  const sentAt = new Date();
  const [preparationMenu, diningFloor, table] = await Promise.all([
    MenuItem.find({ restaurantId, _id: { $in: pendingItems.map(i => i.menuItemId) } }).lean(),
    DiningFloor.findOne({ restaurantId }).lean(),
    Table.findOne({ _id: order.tableId, restaurantId }).select("name").lean(),
  ]);
  const hasExistingKot = await Kot.exists({ restaurantId, orderId: order._id });

  const kotItems = pendingItems.map((item) => {
    item.itemStatus = "sent";
    item.sentAt = sentAt;
    const preparationMinutes = preparationMenu.find(m => m._id.equals(item.menuItemId))?.prepMinutes ?? diningFloor?.policy.defaultPrepMinutes ?? 15;
    item.estimatedReadyAt = new Date(sentAt.getTime() + preparationMinutes * 60000);
    return {
      orderItemId: item._id,
      menuItemId: item.menuItemId,
      nameSnapshot: item.nameSnapshot,
      priceSnapshot: item.priceSnapshot,
      qty: item.qty,
      spiceLevel: item.spiceLevel,
      addOns: item.addOns,
      notes: item.notes,
      itemStatus: "sent" as const,
      estimatedReadyAt: item.estimatedReadyAt,
    };
  });

  const kot = await Kot.create({
    restaurantId,
    orderId: order._id,
    tableId: order.tableId,
    items: kotItems,
    sentAt,
  });

  order.status = hasExistingKot ? "in_kitchen" : "sent";
  await order.save();

  // Inventory auto-deduction side effect (PRD §3.9) — runs only after the
  // order itself has successfully saved, and never throws (see
  // `inventory-deduction.service.ts`), so it can't fail or block this
  // request. Does not affect the return shape, status transitions, or
  // socket events below.
  await deductInventoryForSentItems(
    restaurantId,
    order.createdByStaffId?.toString(),
    order._id.toString(),
    itemsForDeduction,
  );

  const orderDto = toOrderDto(order);
  const kotDto = toKotDto(kot);

  emitToRestaurant(restaurantId, "kitchen:new-ticket", { kot: kotDto });
  emitToRestaurant(restaurantId, "order:updated", { order: orderDto });
  notifyOrderBatch({
    restaurantId,
    orderId: order.id,
    batchKey: kot.id,
    diningSessionId: order.diningSessionId,
    assignedWaiterId: order.assignedWaiter?.id,
    tableLabel: table?.name ?? "Table",
    seats: order.seats,
    itemCount: kotItems.reduce((sum, item) => sum + item.qty, 0),
  });

  return { order: orderDto, kot: kotDto };
}

/**
 * Serves every currently-`ready` item on the order (or, if `itemIds` is
 * given, just those of them that are ready — supports serving a table in
 * more than one pass). Clears each fully-served KOT from the active KDS
 * queue by stamping `Kot.servedAt` (PRD §3.4 "auto-clears ticket from
 * queue upon Serve action"). Sets `order.status = "served"` only once
 * every item on the whole order has reached "served" — an order can have
 * some items served and others still cooking if the kitchen is working a
 * later batch (see `sendToKitchen` doc comment).
 */
export async function serveOrder(
  restaurantId: string,
  staffId: string,
  orderId: string,
  itemIds?: string[],
): Promise<OrderDto> {
  const order = await findOrderOrThrow(restaurantId, orderId);

  const targets = order.items.filter((item) => {
    if (item.itemStatus !== "ready") return false;
    if (itemIds && itemIds.length > 0) return itemIds.includes(item._id.toString());
    return true;
  });

  if (targets.length === 0) {
    throw new AppError("No ready items to serve.", 400, "NOTHING_TO_SERVE");
  }

  const servedIds = new Set(targets.map((item) => item._id.toString()));
  for (const item of targets) {
    item.itemStatus = "served";
  }
  order.servedByStaffId = new Types.ObjectId(staffId);

  const kots = await Kot.find({ restaurantId, orderId: order._id, servedAt: null });
  for (const kot of kots) {
    let changed = false;
    for (const kotItem of kot.items) {
      if (servedIds.has(kotItem.orderItemId.toString())) {
        kotItem.itemStatus = "served";
        changed = true;
      }
    }
    if (kot.items.every((item) => item.itemStatus === "served")) {
      kot.servedAt = new Date();
      changed = true;
    }
    if (changed) await kot.save();
  }

  if (order.items.every((item) => item.itemStatus === "served")) {
    order.status = "served";
  }

  await order.save();

  const dto = toOrderDto(order);
  emitToRestaurant(restaurantId, "order:updated", { order: dto });
  const table = await Table.findOne({ _id: order.tableId, restaurantId }).select("name").lean();
  notifyOrderServed({ restaurantId, orderId: order.id, serveKey: [...servedIds].sort().join(":"), diningSessionId: order.diningSessionId, tableLabel: table?.name ?? "Table", seats: order.seats, items: targets.map((item) => ({ name: item.nameSnapshot, qty: item.qty - (item.cancelledQty ?? 0) })), itemCount: targets.reduce((sum, item) => sum + item.qty - (item.cancelledQty ?? 0), 0), allServed: order.status === "served" });
  return dto;
}

/**
 * Voids the whole order with a mandatory audit reason (PRD §3.3/§3.10).
 * Restricted to Owner/Manager at the route level. Frees the table back to
 * "free" only if no other live order remains for it — defensive, since the
 * normal flow is one active order per table at a time.
 */
export async function voidOrder(
  restaurantId: string,
  staffId: string,
  orderId: string,
  reason: string,
): Promise<OrderDto> {
  const order = await findOrderOrThrow(restaurantId, orderId);

  if (order.status === "billed" || order.status === "closed" || order.status === "void") {
    throw new AppError("This order can no longer be voided.", 400, "ORDER_NOT_VOIDABLE");
  }

  const beforeStatus = order.status;
  order.status = "void";
  order.voidReason = reason;
  await order.save();

  await recordAuditLog({
    restaurantId: order.restaurantId,
    staffId: new Types.ObjectId(staffId),
    action: "order.void",
    entityType: "Order",
    entityId: order._id.toString(),
    beforeValue: { status: beforeStatus },
    afterValue: { status: "void", reason },
  });

  const stillActive = await Order.exists({
    restaurantId,
    tableId: order.tableId,
    status: { $in: ACTIVE_ORDER_STATUSES },
  });
  if (!stillActive && !order.diningSessionId) {
    await tableService.updateTableStatus(restaurantId, order.tableId.toString(), "free");
  }

  const dto = toOrderDto(order);
  emitToRestaurant(restaurantId, "order:updated", { order: dto });
  return dto;
}
