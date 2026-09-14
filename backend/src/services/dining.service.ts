import { createHash, randomBytes } from "crypto";
import { Types } from "mongoose";
import QRCode from "qrcode";
import { DiningFloor, DEFAULT_DINING_POLICY, type DiningFloorDocument, type DiningPolicy, type DiningSession, type SeatSelection } from "../models/dining-floor.model";
import { Table } from "../models/table.model";
import { Restaurant } from "../models/restaurant.model";
import { Area } from "../models/area.model";
import { Category } from "../models/category.model";
import { MenuItem } from "../models/menu-item.model";
import { Order } from "../models/order.model";
import { Kot } from "../models/kot.model";
import { AppError } from "../utils/app-error";
import { toOrderDto, toKotDto } from "./order.service";
import { deductInventoryForSentItems } from "./inventory-deduction.service";
import { emitToRestaurant } from "../sockets";
import { recordAuditLog } from "./audit-log.service";
import { env } from "../config/env";
import { linkDiningCustomer, syncCustomerVisit } from "./customer.service";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const active = (session: DiningSession, now = Date.now()) => session.status === "occupied" ||
  (session.status === "held" && (session.expiresAt === null || Date.parse(session.expiresAt) > now));
const seatKey = (seat: SeatSelection) => `${seat.tableId}:${seat.chairNumber}`;
function expire(floor: DiningFloorDocument) {
  for (const session of floor.sessions) {
    if (session.status === "held" && !active(session)) session.status = "expired";
  }
  // Finished sessions are retained seven days for refresh recovery. Orders keep
  // their own historical session ID and cancellation record indefinitely.
  floor.sessions = floor.sessions.filter(s => active(s) || Date.parse(s.releasedAt ?? s.createdAt) > Date.now() - 7 * 86400000);
}
async function readFloor(restaurantId: string) {
  try {
    await DiningFloor.updateOne({ restaurantId }, { $setOnInsert: { restaurantId, revision: 0, policy: DEFAULT_DINING_POLICY, sessions: [], tableBlocks: {} } }, { upsert: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  return (await DiningFloor.findOne({ restaurantId }).lean())!;
}
/** No process-local lock: a revision predicate serializes competing terminals,
 * including multi-table groups, on standalone MongoDB and replica sets alike. */
export async function changeFloor<T>(restaurantId: string, change: (floor: DiningFloorDocument) => T | Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const floor = await readFloor(restaurantId);
    floor.tableBlocks ??= {};
    expire(floor);
    const result = await change(floor);
    const saved = await DiningFloor.updateOne({ restaurantId, revision: floor.revision }, {
      $set: { sessions: floor.sessions, policy: floor.policy, tableBlocks: floor.tableBlocks }, $inc: { revision: 1 },
    });
    if (saved.modifiedCount) return result;
  }
  throw new AppError("Seating changed. Refresh availability and try again.", 409, "SEATING_BUSY");
}
function sessionDto(session: DiningSession) {
  const { tokenHash: _tokenHash, submission: _submission, staffId: _staffId, ...dto } = session;
  return { ...dto, customer: session.customer ? { name: session.customer.name, phone: session.customer.phone } : undefined };
}
export async function resolveQr(qrToken: string) {
  const [token, chair] = qrToken.split("~");
  const table = await Table.findOne({ qrToken: token });
  if (!table || (chair && (Number(chair) < 1 || Number(chair) > table.seatingCapacity))) {
    throw new AppError("This table QR is no longer available. Please ask a waiter.", 404, "QR_NOT_FOUND");
  }
  return { restaurantId: table.restaurantId.toString(), tableId: table._id.toString(), tableName: table.name, chairNumber: chair ? Number(chair) : null };
}
export async function listSeating(restaurantId: string) {
  const floor = await changeFloor(restaurantId, f => f);
  const [tables, areas] = await Promise.all([Table.find({ restaurantId }).sort({ name: 1 }).lean(), Area.find({ restaurantId }).lean()]);
  const sessions = floor.sessions.filter(s => active(s));
  return {
    tables: tables.map(table => {
      const own = sessions.filter(s => s.seats.some(seat => seat.tableId === table._id.toString()));
      // Legacy full-table orders/reservations still block every chair. A
      // chair-managed table may be shared by otherwise independent parties.
      const blocked = !!floor.tableBlocks[table._id.toString()] || table.status === "reserved" || table.status === "needs_cleaning" || (table.status === "occupied" && own.length === 0);
      return { id: table._id.toString(), name: table.name, areaId: table.areaId.toString(), areaName: areas.find(a => a._id.equals(table.areaId))?.name ?? "Dining room", seatingCapacity: table.seatingCapacity, shape: table.shape, status: table.status,
        chairs: Array.from({ length: table.seatingCapacity }, (_, index) => {
          const number = index + 1;
          const session = own.find(s => s.seats.some(seat => seat.tableId === table._id.toString() && seat.chairNumber === number));
          return { number, status: blocked ? "unavailable" : session?.status ?? "available" };
        }),
      };
    }), sessions: sessions.map(sessionDto), policy: floor.policy, serverNow: new Date().toISOString(),
  };
}
export async function getContext(qrToken: string) {
  const scanned = await resolveQr(qrToken);
  const [restaurant, seating, menu, categories] = await Promise.all([
    Restaurant.findById(scanned.restaurantId), listSeating(scanned.restaurantId),
    MenuItem.find({ restaurantId: scanned.restaurantId, isAvailable: true }).lean(), Category.find({ restaurantId: scanned.restaurantId }).lean(),
  ]);
  if (!restaurant) throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  return { restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug }, scanned,
    tables: seating.tables, policy: seating.policy, taxConfig: restaurant.taxConfig, serverNow: seating.serverNow,
    menu: menu.map(m => ({ id: m._id.toString(), name: m.name, description: m.description, price: m.price, type: m.type, imageUrl: m.imageUrl, categoryId: m.categoryId.toString(), categoryName: categories.find(c => c._id.equals(m.categoryId))?.name ?? "Menu", prepMinutes: m.prepMinutes ?? seating.policy.defaultPrepMinutes })),
  };
}
export async function holdSeats(restaurantId: string, input: { partySize: number; seats: SeatSelection[]; customer?: { name: string; phone: string } }, staffId?: string) {
  if (input.seats.length < input.partySize || new Set(input.seats.map(seatKey)).size !== input.seats.length) throw new AppError("Choose enough different chairs for your group.", 400, "INVALID_SEATS");
  const token = randomBytes(32).toString("hex");
  if (!staffId && !input.customer) throw new AppError("Enter your name and phone number before choosing seats.", 400, "CUSTOMER_REQUIRED");
  const customer = input.customer ? await linkDiningCustomer(restaurantId, input.customer) : undefined;
  const session = await changeFloor(restaurantId, async floor => {
    const tables = await Table.find({ restaurantId, _id: { $in: input.seats.map(s => s.tableId) } }).lean();
    const live = floor.sessions.filter(s => active(s));
    for (const seat of input.seats) {
      const table = tables.find(t => t._id.toString() === seat.tableId);
      if (!table || seat.chairNumber < 1 || seat.chairNumber > table.seatingCapacity) throw new AppError("Selected chair does not exist.", 400, "INVALID_SEATS");
      const tableManaged = live.some(s => s.seats.some(p => p.tableId === seat.tableId));
      if (floor.tableBlocks[seat.tableId] || ["reserved", "needs_cleaning"].includes(table.status) || (table.status === "occupied" && !tableManaged) || live.some(s => s.seats.some(p => seatKey(p) === seatKey(seat)))) throw new AppError("A selected chair was just taken. Choose available chairs again.", 409, "SEAT_UNAVAILABLE");
    }
    const created: DiningSession = { id: new Types.ObjectId().toString(), tokenHash: hash(token), source: staffId ? "staff" : "customer", staffId,
      status: staffId ? "occupied" : "held", partySize: input.partySize, seats: input.seats,
      expiresAt: staffId ? null : new Date(Date.now() + floor.policy.holdMinutes * 60000).toISOString(), createdAt: new Date().toISOString(), policy: { ...floor.policy }, customer };
    floor.sessions.push(created);
    return created;
  });
  emitToRestaurant(restaurantId, "dining:changed", {});
  await syncCustomerVisit(restaurantId, session);
  return { sessionToken: token, session: sessionDto(session), serverNow: new Date().toISOString() };
}
async function authenticateSession(restaurantId: string, token: string) {
  const floor = await changeFloor(restaurantId, f => f);
  const session = floor.sessions.find(s => s.tokenHash === hash(token));
  if (!session) throw new AppError("Dining session not found. Scan your chair QR again.", 401, "DINING_SESSION_INVALID");
  return session;
}
export function cancellationQuote(placedAt: Date, total: number, policy: DiningPolicy, now = Date.now()) {
  const freeUntil = new Date(placedAt.getTime() + policy.freeCancellationMinutes * 60000);
  const partialUntil = new Date(placedAt.getTime() + policy.partialCancellationMinutes * 60000);
  const chargePercent = now < freeUntil.getTime() ? 0 : now < partialUntil.getTime() ? policy.partialChargePercent : 100;
  return { chargePercent, amountDue: Math.round(total * chargePercent / 100), freeUntil: freeUntil.toISOString(), partialUntil: partialUntil.toISOString(), canCancel: true };
}
export async function getSession(restaurantId: string, token: string) {
  const session = await authenticateSession(restaurantId, token);
  if (session.submission) await projectSubmission(restaurantId, session);
  const order = session.orderId ? await Order.findOne({ _id: session.orderId, restaurantId }) : null;
  const cancellation = order?.placedAt ? { ...cancellationQuote(order.placedAt, order.customerTotal ?? 0, session.policy), canCancel: !order.cancellation && ["sent", "in_kitchen", "ready"].includes(order.status) } : null;
  return { session: sessionDto(session), order: order ? toOrderDto(order) : null, cancellation, serverNow: new Date().toISOString() };
}
export async function submitOrder(restaurantId: string, token: string, input: { items: { menuItemId: string; qty: number; notes?: string }[]; idempotencyKey: string }) {
  const initial = await authenticateSession(restaurantId, token);
  const fingerprint = hash(JSON.stringify(input.items));
  if (initial.submission) {
    if (initial.submission.key !== input.idempotencyKey || initial.submission.fingerprint !== fingerprint) throw new AppError("This seating already has an order. Ask your waiter for assistance.", 409, "ORDER_ALREADY_PLACED");
    return getSession(restaurantId, token);
  }
  const [menu, restaurant] = await Promise.all([MenuItem.find({ restaurantId, _id: { $in: input.items.map(i => i.menuItemId) } }).lean(), Restaurant.findById(restaurantId)]);
  if (!restaurant) throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  const placedAt = new Date();
  const items = input.items.map(item => {
    const dish = menu.find(m => m._id.toString() === item.menuItemId);
    if (!dish || !dish.isAvailable) throw new AppError("A selected dish is unavailable. Refresh the menu.", 409, "MENU_ITEM_UNAVAILABLE");
    return { _id: new Types.ObjectId(), menuItemId: dish._id, nameSnapshot: dish.name, priceSnapshot: dish.price, qty: item.qty, notes: item.notes, addOns: [], itemStatus: "sent", sentAt: placedAt, estimatedReadyAt: new Date(placedAt.getTime() + (dish.prepMinutes ?? initial.policy.defaultPrepMinutes) * 60000) };
  });
  const subtotal = items.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);
  const total = subtotal + restaurant.taxConfig.reduce((sum, tax) => sum + Math.round(subtotal * tax.ratePercent / 100), 0);
  const claimed = await changeFloor(restaurantId, floor => {
    const session = floor.sessions.find(s => s.id === initial.id)!;
    if (session.submission) {
      if (session.submission.key !== input.idempotencyKey || session.submission.fingerprint !== fingerprint) throw new AppError("This seating already has an order. Ask your waiter to add items.", 409, "ORDER_ALREADY_PLACED");
      return session;
    }
    if (!active(session)) throw new AppError("Your chair hold expired. Choose your seats again.", 409, "HOLD_EXPIRED");
    session.status = "occupied";
    session.expiresAt = null;
    session.orderId = new Types.ObjectId().toString();
    session.submission = { key: input.idempotencyKey, fingerprint, placedAt: placedAt.toISOString(), items, total };
    return session;
  });
  await projectSubmission(restaurantId, claimed);
  await syncCustomerVisit(restaurantId, claimed);
  return getSession(restaurantId, token);
}
async function projectSubmission(restaurantId: string, claimed: DiningSession) {
  // Durable submission in the seating aggregate is the recovery journal. Each
  // projection uses deterministic IDs; retry cannot create a second order/KOT.
  const submission = claimed.submission!;
  const order = await Order.findOneAndUpdate({ _id: claimed.orderId, restaurantId }, { $setOnInsert: {
    restaurantId, tableId: claimed.seats[0]!.tableId, status: "sent", source: "qr", diningSessionId: claimed.id, seats: claimed.seats,
    items: submission.items, placedAt: new Date(submission.placedAt), customerTotal: submission.total,
  } }, { upsert: true, new: true });
  const kotResult = await Kot.updateOne({ _id: claimed.orderId, restaurantId }, { $setOnInsert: {
    restaurantId, orderId: order!._id, tableId: order!.tableId, sentAt: order!.placedAt,
    items: order!.items.map(i => ({ orderItemId: i._id, menuItemId: i.menuItemId, nameSnapshot: i.nameSnapshot, priceSnapshot: i.priceSnapshot, qty: i.qty, notes: i.notes, addOns: i.addOns, itemStatus: i.itemStatus, estimatedReadyAt: i.estimatedReadyAt })),
  } }, { upsert: true });
  await deductInventoryForSentItems(restaurantId, undefined, order!.id, order!.items.map(i => ({ menuItemId: i.menuItemId.toString(), qty: i.qty })), `qr:${order!.id}`);
  if (kotResult.upsertedCount) {
    const kot = await Kot.findById(claimed.orderId);
    emitToRestaurant(restaurantId, "kitchen:new-ticket", { kot: toKotDto(kot!) });
  }
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order!) });
  emitToRestaurant(restaurantId, "dining:changed", {});
}
export async function cancelOrder(restaurantId: string, token: string, input: { reason: string; acceptedChargePercent: number }) {
  const session = await authenticateSession(restaurantId, token);
  const order = await Order.findOne({ _id: session.orderId, restaurantId });
  if (!order?.placedAt) throw new AppError("No submitted order found.", 404, "NOT_FOUND");
  if (order.cancellation) return getSession(restaurantId, token);
  const quote = cancellationQuote(order.placedAt, order.customerTotal ?? 0, session.policy);
  if (quote.chargePercent !== input.acceptedChargePercent) throw new AppError("The cancellation charge changed. Review the current charge and confirm again.", 409, "CANCELLATION_QUOTE_CHANGED");
  const cancellation = { chargePercent: quote.chargePercent, amountDue: quote.amountDue, cancelledAt: new Date(), reason: input.reason };
  const updated = await Order.findOneAndUpdate({ _id: order._id, restaurantId, status: { $in: ["sent", "in_kitchen", "ready"] }, cancellation: { $exists: false } }, {
    $set: { cancellation, status: quote.amountDue === 0 ? "void" : "served", voidReason: input.reason },
  }, { new: true });
  if (!updated) throw new AppError("This order can no longer be cancelled. Please speak to the counter.", 409, "ORDER_NOT_CANCELLABLE");
  await Kot.updateMany({ restaurantId, orderId: order._id }, { $set: { servedAt: new Date() } });
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(updated) });
  return getSession(restaurantId, token);
}
export async function releaseSession(restaurantId: string, id: string, staffId: string, reason: string) {
  const floor = await readFloor(restaurantId);
  const target = floor.sessions.find(s => s.id === id);
  if (target?.orderId) {
    const order = await Order.findOne({ _id: target.orderId, restaurantId });
    if (!order) throw new AppError("This party's order is being submitted. Refresh before releasing chairs.", 409, "ORDER_SUBMITTING");
    if (order && !["closed", "void"].includes(order.status)) throw new AppError("Settle or void this party's order before releasing their chairs.", 409, "PAYMENT_PENDING");
  }
  const session = await changeFloor(restaurantId, f => {
    const s = f.sessions.find(s => s.id === id);
    if (!s) throw new AppError("Dining session not found.", 404, "NOT_FOUND");
    if (s.orderId !== target?.orderId) throw new AppError("An order was just placed. Refresh before releasing chairs.", 409, "SEATING_CHANGED");
    s.status = "released"; s.releasedAt = new Date().toISOString(); s.releaseReason = reason;
    return s;
  });
  await recordAuditLog({ restaurantId: new Types.ObjectId(restaurantId), staffId: new Types.ObjectId(staffId), action: "dining.release", entityType: "DiningSession", entityId: id, afterValue: { reason, seats: session.seats } });
  await syncCustomerVisit(restaurantId, session);
  emitToRestaurant(restaurantId, "dining:changed", {});
  return { session: sessionDto(session) };
}
export async function updatePolicy(restaurantId: string, policy: DiningPolicy) {
  await changeFloor(restaurantId, floor => { floor.policy = policy; });
  return { policy };
}
export async function staffSessionOrder(restaurantId: string, id: string, staffId: string) {
  const session = await changeFloor(restaurantId, floor => {
    const s = floor.sessions.find(s => s.id === id);
    if (!s || !active(s)) throw new AppError("Active dining party not found.", 404, "NOT_FOUND");
    if (s.source !== "staff" && !s.orderId) throw new AppError("The guest has an active hold. Let them confirm their order first.", 409, "CUSTOMER_HOLD_ACTIVE");
    s.orderId ??= new Types.ObjectId().toString();
    return s;
  });
  if (session.source === "customer") {
    const order = await Order.findOne({ _id: session.orderId, restaurantId });
    if (!order) throw new AppError("The guest order is being submitted. Refresh shortly.", 409, "ORDER_SUBMITTING");
    return { order: toOrderDto(order) };
  }
  const order = await Order.findOneAndUpdate({ _id: session.orderId, restaurantId }, { $setOnInsert: {
    restaurantId, tableId: session.seats[0]!.tableId, status: "draft", source: "staff", diningSessionId: session.id, seats: session.seats, createdByStaffId: staffId, items: [],
  } }, { upsert: true, new: true });
  return { order: toOrderDto(order!) };
}
export async function updatePreparation(restaurantId: string, id: string, prepMinutes: number) {
  const dish = await MenuItem.findOneAndUpdate({ _id: id, restaurantId }, { $set: { prepMinutes } }, { new: true });
  if (!dish) throw new AppError("Dish not found.", 404, "NOT_FOUND");
  return { id, prepMinutes };
}
export async function updateEta(restaurantId: string, id: string, itemId: string, minutes: number) {
  const estimatedReadyAt = new Date(Date.now() + minutes * 60000);
  const order = await Order.findOneAndUpdate({ _id: id, restaurantId, status: { $in: ["sent", "in_kitchen"] }, "items._id": itemId, cancellation: { $exists: false } }, { $set: { "items.$.estimatedReadyAt": estimatedReadyAt } }, { new: true });
  if (!order) throw new AppError("Active order item not found.", 404, "NOT_FOUND");
  await Kot.updateMany({ restaurantId, orderId: id, "items.orderItemId": itemId }, { $set: { "items.$.estimatedReadyAt": estimatedReadyAt } });
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });
  return { order: toOrderDto(order) };
}
function qrAppOrigin(requestOrigin?: string) {
  const normalizedRequestOrigin = requestOrigin?.trim().replace(/\/$/, "");
  if (normalizedRequestOrigin && env.corsOrigins.includes(normalizedRequestOrigin)) {
    return normalizedRequestOrigin;
  }

  const deployedOrigin = env.corsOrigins.find((origin) => {
    try {
      const hostname = new URL(origin).hostname;
      return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1";
    } catch {
      return false;
    }
  });
  return (deployedOrigin ?? env.corsOrigins[0]!).replace(/\/$/, "");
}

export async function chairQrCodes(restaurantId: string, id: string, requestOrigin?: string) {
  const table = await Table.findOne({ _id: id, restaurantId });
  if (!table) throw new AppError("Table not found.", 404, "NOT_FOUND");
  const appOrigin = qrAppOrigin(requestOrigin);
  const codes = await Promise.all(Array.from({ length: table.seatingCapacity }, async (_, index) => {
    const chairNumber = index + 1;
    const token = `${table.qrToken}~${chairNumber}`;
    const url = `${appOrigin}/order/${token}`;
    return { chairNumber, token, url, svg: await QRCode.toString(url, { type: "svg", margin: 2 }) };
  }));
  return { table: { id, name: table.name }, codes };
}
