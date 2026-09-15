import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Types } from "mongoose";
import QRCode from "qrcode";
import { DiningFloor, DEFAULT_DINING_POLICY, type DiningFloorDocument, type DiningPolicy, type DiningSession, type SeatSelection } from "../models/dining-floor.model";
import { Table } from "../models/table.model";
import { Restaurant } from "../models/restaurant.model";
import { Area } from "../models/area.model";
import { Category } from "../models/category.model";
import { MenuItem } from "../models/menu-item.model";
import { Order, type OrderItemSubdocument } from "../models/order.model";
import { Kot } from "../models/kot.model";
import { AppError } from "../utils/app-error";
import { toOrderDto, toKotDto } from "./order.service";
import { deductInventoryForSentItems } from "./inventory-deduction.service";
import { emitToRestaurant } from "../sockets";
import { recordAuditLog } from "./audit-log.service";
import { env } from "../config/env";
import { linkDiningCustomer, syncCustomerVisit } from "./customer.service";
import { aggregateTaxLines, calculateOrderBill, taxForAmount } from "./dining-billing.service";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { Payment } from "../models/payment.model";
import { notifyOrderBatch } from "./notification.service";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Session tokens authenticate an unauthenticated guest, so the lookup must not leak
// timing information about how many leading hex characters of a guessed token hash
// matched a stored one (the codebase already uses timingSafeEqual for webhook
// signatures in middleware/verify-meta-signature.ts; this applies the same pattern).
function safeHashEquals(a: string, b: string) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
const deterministicId = (value: string) => new Types.ObjectId(hash(value).slice(0, 24));
const active = (session: DiningSession, now = Date.now()) => session.status === "occupied" || session.status === "cleaning" ||
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
/** Read-only equivalent of `changeFloor(restaurantId, f => f)`, for polled
 * reads (guest session refresh, seating list) that outnumber writes many
 * times over. Applies the same in-memory `expire()` so callers see accurate
 * held-session state, but skips the revision-incrementing `updateOne` —
 * that write only matters when something is actually changing, and every
 * real mutation already re-reads and persists through `changeFloor`. */
async function peekFloor(restaurantId: string) {
  const floor = await readFloor(restaurantId);
  floor.tableBlocks ??= {};
  expire(floor);
  return floor;
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
  return { ...dto, bookingMode: session.bookingMode ?? "chairs", assignedWaiter: session.assignedWaiter ?? null, customer: session.customer ? { name: session.customer.name, phone: session.customer.phone } : undefined };
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
  const floor = await peekFloor(restaurantId);
  const [tables, areas] = await Promise.all([Table.find({ restaurantId }).sort({ name: 1 }).lean(), Area.find({ restaurantId }).lean()]);
  const sessions = floor.sessions.filter(s => active(s));
  return {
    tables: tables.map(table => {
      const own = sessions.filter(s => s.seats.some(seat => seat.tableId === table._id.toString()));
      // Legacy full-table orders/reservations still block every chair. A
      // chair-managed table may be shared by otherwise independent parties.
      const blocked = !!floor.tableBlocks[table._id.toString()] || table.status === "reserved" || table.status === "needs_cleaning" || (table.status === "occupied" && own.length === 0);
      const wholeTableSession = own.find((session) => session.bookingMode === "whole_table" && session.seats.filter((seat) => seat.tableId === table._id.toString()).length === table.seatingCapacity);
      return { id: table._id.toString(), name: table.name, areaId: table.areaId.toString(), areaName: areas.find(a => a._id.equals(table.areaId))?.name ?? "Dining room", seatingCapacity: table.seatingCapacity, shape: table.shape, status: table.status,
        bookingMode: wholeTableSession ? "whole_table" : own.length ? "chairs" : null,
        wholeTableOccupied: !!wholeTableSession && wholeTableSession.status === "occupied",
        wholeTableCleaning: !!wholeTableSession && wholeTableSession.status === "cleaning",
        assignedWaiter: wholeTableSession?.assignedWaiter ?? own.find((session) => session.assignedWaiter)?.assignedWaiter ?? null,
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
export async function holdSeats(restaurantId: string, input: { partySize: number; seats: SeatSelection[]; bookingMode?: "whole_table" | "chairs"; customer?: { name: string; phone: string } }, staffId?: string) {
  if (input.seats.length < input.partySize || new Set(input.seats.map(seatKey)).size !== input.seats.length) throw new AppError("Choose enough different chairs for your group.", 400, "INVALID_SEATS");
  const token = randomBytes(32).toString("hex");
  if (!staffId && !input.customer) throw new AppError("Enter your name and phone number before choosing seats.", 400, "CUSTOMER_REQUIRED");
  const customer = input.customer ? await linkDiningCustomer(restaurantId, input.customer) : undefined;
  const session = await changeFloor(restaurantId, async floor => {
    const tables = await Table.find({ restaurantId, _id: { $in: input.seats.map(s => s.tableId) } }).lean();
    const selectedByTable = new Map<string, number>();
    input.seats.forEach((seat) => selectedByTable.set(seat.tableId, (selectedByTable.get(seat.tableId) ?? 0) + 1));
    const coversEverySelectedTable = tables.length === selectedByTable.size && tables.every((table) => selectedByTable.get(table._id.toString()) === table.seatingCapacity);
    if (input.bookingMode === "whole_table" && !coversEverySelectedTable) throw new AppError("Whole-table booking must include every chair at the selected table.", 400, "WHOLE_TABLE_SEATS_REQUIRED");
    const live = floor.sessions.filter(s => active(s));
    for (const seat of input.seats) {
      const table = tables.find(t => t._id.toString() === seat.tableId);
      if (!table || seat.chairNumber < 1 || seat.chairNumber > table.seatingCapacity) throw new AppError("Selected chair does not exist.", 400, "INVALID_SEATS");
      const tableManaged = live.some(s => s.seats.some(p => p.tableId === seat.tableId));
      if (floor.tableBlocks[seat.tableId] || ["reserved", "needs_cleaning"].includes(table.status) || (table.status === "occupied" && !tableManaged) || live.some(s => s.seats.some(p => seatKey(p) === seatKey(seat)))) throw new AppError("A selected chair was just taken. Choose available chairs again.", 409, "SEAT_UNAVAILABLE");
    }
    const created: DiningSession = { id: new Types.ObjectId().toString(), tokenHash: hash(token), source: staffId ? "staff" : "customer", staffId,
      status: staffId ? "occupied" : "held", bookingMode: input.bookingMode ?? (coversEverySelectedTable ? "whole_table" : "chairs"), partySize: input.partySize, seats: input.seats,
      expiresAt: staffId ? null : new Date(Date.now() + floor.policy.holdMinutes * 60000).toISOString(), createdAt: new Date().toISOString(), policy: { ...floor.policy }, customer };
    floor.sessions.push(created);
    return created;
  });
  emitToRestaurant(restaurantId, "dining:changed", {});
  await syncCustomerVisit(restaurantId, session);
  return { sessionToken: token, session: sessionDto(session), serverNow: new Date().toISOString() };
}
async function authenticateSession(restaurantId: string, token: string) {
  const floor = await peekFloor(restaurantId);
  const tokenHash = hash(token);
  const session = floor.sessions.find(s => safeHashEquals(s.tokenHash, tokenHash));
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
  const [order, restaurant] = await Promise.all([
    session.orderId ? Order.findOne({ _id: session.orderId, restaurantId }) : null,
    Restaurant.findById(restaurantId).lean(),
  ]);
  const activeStatuses = ["sent", "in_kitchen", "ready", "served"];
  const cancellationOptions = order && activeStatuses.includes(order.status)
    ? order.items.flatMap((item) => {
      const availableQty = item.qty - (item.cancelledQty ?? 0);
      if (availableQty <= 0) return [];
      const subtotal = item.priceSnapshot * availableQty;
      const timing = cancellationQuote(item.sentAt ?? order.placedAt ?? order.createdAt, subtotal, session.policy);
      const baseCharge = Math.round((subtotal * timing.chargePercent) / 100);
      const taxLines = restaurant ? taxForAmount(baseCharge, restaurant.taxConfig) : [];
      return [{
        orderItemId: item._id.toString(),
        nameSnapshot: item.nameSnapshot,
        availableQty,
        ...timing,
        subtotal,
        baseCharge,
        taxLines,
        amountDue: baseCharge + taxLines.reduce((sum, tax) => sum + tax.amount, 0),
      }];
      })
    : [];
  const cancellation = cancellationOptions.length
    ? {
        chargePercent: new Set(cancellationOptions.map((line) => line.chargePercent)).size === 1 ? cancellationOptions[0]!.chargePercent : null,
        amountDue: cancellationOptions.reduce((sum, line) => sum + line.amountDue, 0),
        freeUntil: cancellationOptions.map((line) => line.freeUntil).sort()[0],
        partialUntil: cancellationOptions.map((line) => line.partialUntil).sort()[0],
        canCancel: true,
      }
    : null;
  let bill = order && restaurant ? calculateOrderBill(order, restaurant.taxConfig) : null;
  if (bill && order) {
    const invoice = await Invoice.findOne({ restaurantId, orderId: order._id, status: "issued" }).sort({ createdAt: -1 }).lean();
    if (invoice) {
      const paid = await Payment.aggregate<{ amount: number }>([
        { $match: { restaurantId: new Types.ObjectId(restaurantId), invoiceId: invoice._id } },
        { $group: { _id: null, amount: { $sum: "$amount" } } },
      ]);
      bill = {
        ...bill,
        taxableSubtotal: invoice.subtotal - (invoice.discount?.amountApplied ?? 0),
        taxLines: invoice.taxLines,
        totalDue: invoice.total,
        paymentDue: Math.max(0, invoice.total - (paid[0]?.amount ?? 0)),
        explanation: "Invoice total = subtotal - discount + the listed taxes. Payment due shows the unpaid balance in paise.",
        ...(invoice.discount ? { discount: { type: invoice.discount.type, value: invoice.discount.value, amount: invoice.discount.amountApplied } } : {}),
      };
    }
  }
  return {
    session: sessionDto(session),
    order: order ? toOrderDto(order) : null,
    cancellation,
    cancellationOptions,
    bill,
    canAddItems: !!order && activeStatuses.includes(order.status) && !order.cancellation,
    serverNow: new Date().toISOString(),
  };
}

async function ensureAssignedWaiter(restaurantId: string, session: DiningSession) {
  if (session.assignedWaiter) return session;
  const waiter = await User.findOne({ restaurantId, role: "server", isActive: true }).sort({ createdAt: 1 }).select("name").lean();
  if (!waiter) return session;
  return changeFloor(restaurantId, (floor) => {
    const current = floor.sessions.find((candidate) => candidate.id === session.id);
    if (!current || !active(current)) throw new AppError("Your seating ended before a waiter could be assigned.", 409, "DINING_SESSION_ENDED");
    current.assignedWaiter ??= { id: waiter._id.toString(), name: waiter.name };
    return current;
  });
}

export async function submitOrder(restaurantId: string, token: string, input: { items: { menuItemId: string; qty: number; notes?: string }[]; idempotencyKey: string }) {
  let initial = await authenticateSession(restaurantId, token);
  initial = await ensureAssignedWaiter(restaurantId, initial);
  const fingerprint = hash(JSON.stringify(input.items));
  if (initial.submission) {
    if (initial.submission.key === input.idempotencyKey) {
      if (initial.submission.fingerprint !== fingerprint) throw new AppError("This request key was already used for different items.", 409, "IDEMPOTENCY_KEY_REUSED");
      await projectSubmission(restaurantId, initial);
      return getSession(restaurantId, token);
    }
    return addItemsToOrder(restaurantId, token, initial, input, fingerprint);
  }
  const [menu, restaurant] = await Promise.all([MenuItem.find({ restaurantId, _id: { $in: input.items.map(i => i.menuItemId) } }).lean(), Restaurant.findById(restaurantId)]);
  if (!restaurant) throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  const placedAt = new Date();
  const items = input.items.map((item, index) => {
    const dish = menu.find(m => m._id.toString() === item.menuItemId);
    if (!dish || !dish.isAvailable) throw new AppError("A selected dish is unavailable. Refresh the menu.", 409, "MENU_ITEM_UNAVAILABLE");
    return { _id: deterministicId(`${restaurantId}:${initial.id}:${input.idempotencyKey}:item:${index}`), menuItemId: dish._id, nameSnapshot: dish.name, priceSnapshot: dish.price, qty: item.qty, cancelledQty: 0, guestSubmissionKey: input.idempotencyKey, notes: item.notes, addOns: [], itemStatus: "sent", sentAt: placedAt, estimatedReadyAt: new Date(placedAt.getTime() + (dish.prepMinutes ?? initial.policy.defaultPrepMinutes) * 60000) };
  });
  const subtotal = items.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);
  const total = subtotal + restaurant.taxConfig.reduce((sum, tax) => sum + Math.round(subtotal * tax.ratePercent / 100), 0);
  const claimed = await changeFloor(restaurantId, floor => {
    const session = floor.sessions.find(s => s.id === initial.id)!;
    if (session.submission) {
      if (session.submission.key !== input.idempotencyKey || session.submission.fingerprint !== fingerprint) throw new AppError("Another order was submitted. Refresh and add your items again.", 409, "ORDER_CHANGED");
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
    restaurantId, tableId: claimed.seats[0]!.tableId, status: "sent", source: "qr", diningSessionId: claimed.id, assignedWaiter: claimed.assignedWaiter, seats: claimed.seats,
    items: submission.items, placedAt: new Date(submission.placedAt), customerTotal: submission.total,
    guestSubmissions: [{ key: submission.key, fingerprint: submission.fingerprint, placedAt: new Date(submission.placedAt) }],
  } }, { upsert: true, new: true });
  const submissionItems = order!.items.filter(i => i.guestSubmissionKey === submission.key || !i.guestSubmissionKey);
  const kotResult = await Kot.updateOne({ _id: claimed.orderId, restaurantId }, { $setOnInsert: {
    restaurantId, orderId: order!._id, tableId: order!.tableId, sentAt: order!.placedAt,
    items: submissionItems.map(i => ({ orderItemId: i._id, menuItemId: i.menuItemId, nameSnapshot: i.nameSnapshot, priceSnapshot: i.priceSnapshot, qty: i.qty, cancelledQty: i.cancelledQty ?? 0, notes: i.notes, addOns: i.addOns, itemStatus: i.itemStatus, estimatedReadyAt: i.estimatedReadyAt })),
  } }, { upsert: true });
  await deductInventoryForSentItems(restaurantId, undefined, order!.id, submissionItems.map(i => ({ menuItemId: i.menuItemId.toString(), qty: i.qty })), `qr:${order!.id}`);
  if (kotResult.upsertedCount) {
    const kot = await Kot.findById(claimed.orderId);
    emitToRestaurant(restaurantId, "kitchen:new-ticket", { kot: toKotDto(kot!) });
  }
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order!) });
  emitToRestaurant(restaurantId, "dining:changed", {});
  const table = await Table.findOne({ _id: order!.tableId, restaurantId }).select("name").lean();
  notifyOrderBatch({ restaurantId, orderId: order!.id, batchKey: submission.key, diningSessionId: claimed.id, assignedWaiterId: claimed.assignedWaiter?.id, tableLabel: table?.name ?? "Table", seats: claimed.seats, itemCount: submissionItems.reduce((sum, item) => sum + item.qty, 0) });
}

async function addItemsToOrder(
  restaurantId: string,
  token: string,
  session: DiningSession,
  input: { items: { menuItemId: string; qty: number; notes?: string }[]; idempotencyKey: string },
  fingerprint: string,
) {
  const current = await Order.findOne({ _id: session.orderId, restaurantId });
  if (!current) throw new AppError("Your first order is still being submitted. Try again shortly.", 409, "ORDER_SUBMITTING");
  const previous = (current.guestSubmissions ?? []).find((entry) => entry.key === input.idempotencyKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new AppError("This request key was already used for different items.", 409, "IDEMPOTENCY_KEY_REUSED");
    const previousItems = current.items.filter((item) => item.guestSubmissionKey === input.idempotencyKey);
    await projectAddedBatch(restaurantId, current, input.idempotencyKey, previousItems, previous.placedAt);
    return getSession(restaurantId, token);
  }
  if (current.cancellation || !["sent", "in_kitchen", "ready", "served"].includes(current.status)) {
    throw new AppError("This order can no longer accept items. Please ask the counter.", 409, "ORDER_NOT_ACTIVE");
  }
  const menu = await MenuItem.find({ restaurantId, _id: { $in: input.items.map((item) => item.menuItemId) } }).lean();
  const placedAt = new Date();
  const items = input.items.map((item, index) => {
    const dish = menu.find((candidate) => candidate._id.toString() === item.menuItemId);
    if (!dish || !dish.isAvailable) throw new AppError("A selected dish is unavailable. Refresh the menu.", 409, "MENU_ITEM_UNAVAILABLE");
    return {
      _id: deterministicId(`${restaurantId}:${session.id}:${input.idempotencyKey}:item:${index}`),
      menuItemId: dish._id,
      nameSnapshot: dish.name,
      priceSnapshot: dish.price,
      qty: item.qty,
      cancelledQty: 0,
      guestSubmissionKey: input.idempotencyKey,
      notes: item.notes,
      addOns: [],
      itemStatus: "sent",
      sentAt: placedAt,
      estimatedReadyAt: new Date(placedAt.getTime() + (dish.prepMinutes ?? session.policy.defaultPrepMinutes) * 60000),
    };
  });
  let updated = await Order.findOneAndUpdate(
    { _id: current._id, restaurantId, status: { $in: ["sent", "in_kitchen", "ready", "served"] }, cancellation: { $exists: false }, "guestSubmissions.key": { $ne: input.idempotencyKey } },
    { $push: { items: { $each: items }, guestSubmissions: { key: input.idempotencyKey, fingerprint, placedAt } }, $set: { status: "sent", ...(session.assignedWaiter ? { assignedWaiter: session.assignedWaiter } : {}) } },
    { new: true },
  );
  if (!updated) {
    updated = await Order.findOne({ _id: current._id, restaurantId });
    const winner = updated?.guestSubmissions?.find((entry) => entry.key === input.idempotencyKey);
    if (!updated || !winner) throw new AppError("The order changed. Refresh and try again.", 409, "ORDER_CHANGED");
    if (winner.fingerprint !== fingerprint) throw new AppError("This request key was already used for different items.", 409, "IDEMPOTENCY_KEY_REUSED");
  }
  const batchItems = updated.items.filter((item) => item.guestSubmissionKey === input.idempotencyKey);
  await projectAddedBatch(restaurantId, updated, input.idempotencyKey, batchItems, placedAt);
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (restaurant) {
    updated.customerTotal = calculateOrderBill(updated, restaurant.taxConfig).totalDue;
    await updated.save();
  }
  await syncCustomerVisit(restaurantId, session);
  return getSession(restaurantId, token);
}

async function projectAddedBatch(restaurantId: string, order: InstanceType<typeof Order>, key: string, items: OrderItemSubdocument[], placedAt: Date) {
  const kotId = deterministicId(`${restaurantId}:${order.id}:${key}:kot`);
  const kotResult = await Kot.updateOne({ _id: kotId, restaurantId }, { $setOnInsert: {
    restaurantId,
    orderId: order._id,
    tableId: order.tableId,
    sentAt: placedAt,
    items: items.map((item) => ({ orderItemId: item._id, menuItemId: item.menuItemId, nameSnapshot: item.nameSnapshot, priceSnapshot: item.priceSnapshot, qty: item.qty, cancelledQty: item.cancelledQty ?? 0, notes: item.notes, addOns: item.addOns, itemStatus: item.itemStatus, estimatedReadyAt: item.estimatedReadyAt })),
  } }, { upsert: true });
  await deductInventoryForSentItems(restaurantId, undefined, order.id, items.map((item) => ({ menuItemId: item.menuItemId.toString(), qty: item.qty })), `qr:${order.id}:${key}`);
  if (kotResult.upsertedCount) {
    const kot = await Kot.findById(kotId);
    if (kot) emitToRestaurant(restaurantId, "kitchen:new-ticket", { kot: toKotDto(kot) });
  }
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(order) });
  const table = await Table.findOne({ _id: order.tableId, restaurantId }).select("name").lean();
  notifyOrderBatch({ restaurantId, orderId: order.id, batchKey: key, diningSessionId: order.diningSessionId, assignedWaiterId: order.assignedWaiter?.id, tableLabel: table?.name ?? "Table", seats: order.seats, itemCount: items.reduce((sum, item) => sum + item.qty, 0) });
}

type CancellationSelection = { orderItemId: string; qty: number; acceptedChargePercent?: number };

async function cancellationSelectionQuote(restaurantId: string, session: DiningSession, selections?: CancellationSelection[]) {
  const [order, restaurant] = await Promise.all([
    Order.findOne({ _id: session.orderId, restaurantId }),
    Restaurant.findById(restaurantId).lean(),
  ]);
  if (!order?.placedAt) throw new AppError("No submitted order found.", 404, "NOT_FOUND");
  if (!restaurant) throw new AppError("Restaurant not found.", 404, "NOT_FOUND");
  if (!["sent", "in_kitchen", "ready", "served"].includes(order.status) || order.cancellation) throw new AppError("This order can no longer be cancelled.", 409, "ORDER_NOT_CANCELLABLE");
  const requested = selections ?? order.items.flatMap((item) => {
    const qty = item.qty - (item.cancelledQty ?? 0);
    return qty > 0 ? [{ orderItemId: item._id.toString(), qty }] : [];
  });
  if (!requested.length) throw new AppError("Choose at least one item to cancel.", 400, "CANCELLATION_ITEMS_REQUIRED");
  if (new Set(requested.map((item) => item.orderItemId)).size !== requested.length) throw new AppError("Each order item can be selected once.", 400, "DUPLICATE_CANCELLATION_ITEM");
  const lines = requested.map((selected) => {
    const item = order.items.id(selected.orderItemId);
    const availableQty = item ? item.qty - (item.cancelledQty ?? 0) : 0;
    if (!item || selected.qty < 1 || selected.qty > availableQty) throw new AppError("A selected quantity is no longer available. Refresh the order.", 409, "CANCELLATION_QUANTITY_CHANGED");
    const subtotal = item.priceSnapshot * selected.qty;
    const timing = cancellationQuote(item.sentAt ?? order.placedAt ?? order.createdAt, subtotal, session.policy);
    const baseCharge = Math.round((subtotal * timing.chargePercent) / 100);
    const taxLines = taxForAmount(baseCharge, restaurant.taxConfig);
    return {
      orderItemId: item._id.toString(),
      nameSnapshot: item.nameSnapshot,
      qty: selected.qty,
      unitPrice: item.priceSnapshot,
      subtotal,
      chargePercent: timing.chargePercent,
      baseCharge,
      taxLines,
      amountDue: baseCharge + taxLines.reduce((sum, tax) => sum + tax.amount, 0),
      freeUntil: timing.freeUntil,
      partialUntil: timing.partialUntil,
    };
  });
  const taxLines = aggregateTaxLines(lines.flatMap((line) => line.taxLines));
  return {
    order,
    lines,
    totals: {
      selectedSubtotal: lines.reduce((sum, line) => sum + line.subtotal, 0),
      baseCharge: lines.reduce((sum, line) => sum + line.baseCharge, 0),
      taxLines,
      amountDue: lines.reduce((sum, line) => sum + line.amountDue, 0),
    },
    serverNow: new Date().toISOString(),
  };
}

export async function quoteCancellation(restaurantId: string, token: string, input: { items: { orderItemId: string; qty: number }[] }) {
  const session = await authenticateSession(restaurantId, token);
  const { order: _order, ...quote } = await cancellationSelectionQuote(restaurantId, session, input.items);
  return quote;
}

export async function cancelOrder(restaurantId: string, token: string, input: { reason: string; idempotencyKey?: string; acceptedChargePercent?: number; items?: CancellationSelection[] }) {
  const session = await authenticateSession(restaurantId, token);
  const fingerprint = hash(JSON.stringify({ reason: input.reason, items: input.items ?? null, acceptedChargePercent: input.acceptedChargePercent ?? null }));
  const currentOrder = await Order.findOne({ _id: session.orderId, restaurantId });
  if (input.idempotencyKey) {
    const previous = currentOrder?.cancellations?.find((entry) => entry.idempotencyKey === input.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new AppError("This cancellation key was already used for a different selection.", 409, "IDEMPOTENCY_KEY_REUSED");
      return getSession(restaurantId, token);
    }
  }
  if (!input.items && currentOrder?.cancellation) return getSession(restaurantId, token);
  const quote = await cancellationSelectionQuote(restaurantId, session, input.items);
  for (const line of quote.lines) {
    const accepted = input.items?.find((item) => item.orderItemId === line.orderItemId)?.acceptedChargePercent ?? input.acceptedChargePercent;
    if (accepted !== line.chargePercent) throw new AppError("The cancellation charge changed. Review the current charge and confirm again.", 409, "CANCELLATION_QUOTE_CHANGED");
  }
  const cancelledAt = new Date();
  const record = {
    _id: new Types.ObjectId(),
    idempotencyKey: input.idempotencyKey,
    fingerprint,
    reason: input.reason,
    cancelledAt,
    lines: quote.lines.map(({ freeUntil: _freeUntil, partialUntil: _partialUntil, ...line }) => ({ ...line, orderItemId: new Types.ObjectId(line.orderItemId) })),
    selectedSubtotal: quote.totals.selectedSubtotal,
    baseCharge: quote.totals.baseCharge,
    taxLines: quote.totals.taxLines,
    amountDue: quote.totals.amountDue,
  };
  const query: Record<string, unknown> = { _id: quote.order._id, restaurantId, status: { $in: ["sent", "in_kitchen", "ready", "served"] }, cancellation: { $exists: false } };
  const update: Record<string, number> = {};
  const arrayFilters: Record<string, unknown>[] = [];
  const concurrencyPredicates: Record<string, unknown>[] = [];
  quote.lines.forEach((line, index) => {
    const current = quote.order.items.id(line.orderItemId)!;
    update[`items.$[item${index}].cancelledQty`] = line.qty;
    arrayFilters.push({ [`item${index}._id`]: current._id, [`item${index}.cancelledQty`]: current.cancelledQty ?? 0 });
    concurrencyPredicates.push({ items: { $elemMatch: { _id: current._id, $or: [{ cancelledQty: current.cancelledQty ?? 0 }, ...((current.cancelledQty ?? 0) === 0 ? [{ cancelledQty: { $exists: false } }] : [])] } } });
  });
  query.$and = concurrencyPredicates;
  const remainingAfter = quote.order.items.reduce((sum, item) => sum + item.qty - (item.cancelledQty ?? 0), 0) - quote.lines.reduce((sum, line) => sum + line.qty, 0);
  const set: Record<string, unknown> = {};
  if (remainingAfter === 0) {
    const priorCharge = (quote.order.cancellations ?? []).reduce((sum, cancellation) => sum + cancellation.amountDue, 0);
    const amountDue = priorCharge + quote.totals.amountDue;
    const percents = [...(quote.order.cancellations ?? []).flatMap((entry) => entry.lines.map((line) => line.chargePercent)), ...quote.lines.map((line) => line.chargePercent)];
    set.status = amountDue === 0 ? "void" : "served";
    set.voidReason = input.reason;
    set.cancellation = { chargePercent: new Set(percents).size === 1 ? percents[0] : 0, amountDue, cancelledAt, reason: input.reason };
  }
  const updated = await Order.findOneAndUpdate(
    query,
    { $inc: update, $push: { cancellations: record }, ...(Object.keys(set).length ? { $set: set } : {}) },
    { new: true, arrayFilters },
  );
  if (!updated) {
    if (input.idempotencyKey) {
      const replay = await Order.findOne({ _id: quote.order._id, restaurantId, cancellations: { $elemMatch: { idempotencyKey: input.idempotencyKey, fingerprint } } });
      if (replay) return getSession(restaurantId, token);
    }
    throw new AppError("This order can no longer be cancelled. Please speak to the counter.", 409, "ORDER_NOT_CANCELLABLE");
  }
  for (const line of quote.lines) {
    await Kot.updateOne(
      { restaurantId, orderId: updated._id, "items.orderItemId": line.orderItemId },
      { $inc: { "items.$.cancelledQty": line.qty } },
    );
  }
  const kots = await Kot.find({ restaurantId, orderId: updated._id });
  for (const kot of kots) {
    if (kot.items.every((item) => (item.cancelledQty ?? 0) >= item.qty) && !kot.servedAt) {
      kot.allReadyAt ??= cancelledAt;
      kot.servedAt = cancelledAt;
      await kot.save();
    }
  }
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (restaurant) {
    updated.customerTotal = calculateOrderBill(updated, restaurant.taxConfig).totalDue;
    await updated.save();
  }
  emitToRestaurant(restaurantId, "order:updated", { order: toOrderDto(updated) });
  return getSession(restaurantId, token);
}

/** Payment ends guest service but keeps the exact paid chairs blocked until
 * staff confirms they were cleaned. Safe to replay after payment retries. */
export async function markDiningSessionCleaning(restaurantId: string, sessionId: string) {
  const session = await changeFloor(restaurantId, (floor) => {
    const current = floor.sessions.find((candidate) => candidate.id === sessionId);
    if (!current) throw new AppError("Dining session not found.", 404, "NOT_FOUND");
    if (current.status === "released" || current.status === "expired") return current;
    current.status = "cleaning";
    current.expiresAt = null;
    current.cleaningAt ??= new Date().toISOString();
    return current;
  });
  await syncCustomerVisit(restaurantId, session);
  emitToRestaurant(restaurantId, "dining:changed", {});
  return { session: sessionDto(session) };
}

export async function markDiningSessionAvailable(restaurantId: string, id: string, staffId: string) {
  const session = await changeFloor(restaurantId, (floor) => {
    const current = floor.sessions.find((candidate) => candidate.id === id);
    if (!current) throw new AppError("Dining session not found.", 404, "NOT_FOUND");
    if (current.status === "released") return current;
    if (current.status !== "cleaning") throw new AppError("Only chairs waiting for cleaning can be marked available.", 409, "SESSION_NOT_CLEANING");
    current.status = "released";
    current.releasedAt = new Date().toISOString();
    current.releaseReason = "Cleaning completed";
    return current;
  });
  await recordAuditLog({ restaurantId: new Types.ObjectId(restaurantId), staffId: new Types.ObjectId(staffId), action: "dining.cleaned", entityType: "DiningSession", entityId: id, afterValue: { seats: session.seats } });
  await syncCustomerVisit(restaurantId, session);
  emitToRestaurant(restaurantId, "dining:changed", {});
  return { session: sessionDto(session) };
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
