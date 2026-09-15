import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestInventoryItem, createTestRestaurant, createTestStaff, createTestTable, createTestMenuItem, tokenFor } from "./utils/fixtures";
import * as dining from "../src/services/dining.service";
import * as orders from "../src/services/order.service";
import * as tables from "../src/services/table.service";
import * as kitchen from "../src/services/kitchen.service";
import * as invoices from "../src/services/invoice.service";
import * as payments from "../src/services/payment.service";
import * as customers from "../src/services/customer.service";
import { DiningFloor, DEFAULT_DINING_POLICY } from "../src/models/dining-floor.model";
import { Order } from "../src/models/order.model";
import { Kot } from "../src/models/kot.model";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { InventoryItem } from "../src/models/inventory-item.model";
import { InventoryTransaction } from "../src/models/inventory-transaction.model";
import { CustomerVisit } from "../src/models/customer-visit.model";

describe("Chair dining, kitchen and counter settlement", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);
  async function setup() {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant.id;
    const table = await createTestTable(restaurantId);
    const dish = await createTestMenuItem(restaurantId);
    const { user } = await createTestStaff(restaurantId, "owner");
    return { restaurantId, table, dish, user };
  }
  it("uses exact 8 and 10 minute boundaries and integer rounding", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    for (const [elapsed, percent] of [[479999, 0], [480000, 50], [599999, 50], [600000, 100]]) {
      const quote = dining.cancellationQuote(start, 101, DEFAULT_DINING_POLICY, start.getTime() + elapsed!);
      expect(quote.chargePercent).toBe(percent);
      expect(quote.amountDue).toBe(percent === 50 ? 51 : percent === 0 ? 0 : 101);
    }
  });
  it("generates chair QR codes for the deployed frontend origin", async () => {
    const { table, user } = await setup();
    const deployedOrigin = "https://restaurant-pos-fontend.vercel.app";
    env.corsOrigins.push(deployedOrigin);
    try {
      const response = await request(createApp())
        .get(`/api/dining/tables/${table.id}/qr`)
        .set("Authorization", `Bearer ${tokenFor(user)}`)
        .set("Origin", deployedOrigin);
      expect(response.status).toBe(200);
      expect(response.body.codes[0].url).toBe(`${deployedOrigin}/order/${table.qrToken}~1`);
      expect(response.body.codes[0].url).not.toContain("localhost");
    } finally {
      env.corsOrigins.splice(env.corsOrigins.indexOf(deployedOrigin), 1);
    }
  });
  it("atomically claims all selected chairs across two tables under contention", async () => {
    const { restaurantId, table } = await setup();
    const second = await createTestTable(restaurantId);
    const seats = [{ tableId: table.id, chairNumber: 1 }, { tableId: second.id, chairNumber: 1 }];
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => dining.holdSeats(restaurantId, { partySize: 2, seats, customer: { name: "Aarav Group", phone: "9876543210" } })));
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    const floor = await dining.listSeating(restaurantId);
    expect(floor.sessions).toHaveLength(1);
    expect(floor.sessions[0]!.seats).toHaveLength(2);
  });
  it("expires customer holds, keeps staff chairs, and rejects stale session orders", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const guest = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    const staff = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 2 }] }, user.id);
    await dining.changeFloor(restaurantId, floor => { floor.sessions.find(s => s.id === guest.session.id)!.expiresAt = new Date(Date.now() - 1).toISOString(); });
    expect((await dining.getSession(restaurantId, guest.sessionToken)).session.status).toBe("expired");
    expect((await dining.getSession(restaurantId, staff.sessionToken)).session.expiresAt).toBeNull();
    await expect(dining.submitOrder(restaurantId, guest.sessionToken, { idempotencyKey: "test-request", items: [{ menuItemId: dish.id, qty: 1 }] })).rejects.toMatchObject({ code: "HOLD_EXPIRED" });
    await expect(dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } })).resolves.toBeDefined();
  });
  it("creates one real order and KOT on retried submit with ETA; paid chairs wait for cleaning", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const guest = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 2 }], customer: { name: "Diya", phone: "9876543211" } });
    const input = { idempotencyKey: "test-request", items: [{ menuItemId: dish.id, qty: 1 }] };
    const submitted = await dining.submitOrder(restaurantId, guest.sessionToken, input);
    await dining.submitOrder(restaurantId, guest.sessionToken, input);
    expect(await Order.countDocuments()).toBe(1);
    expect(await Kot.countDocuments()).toBe(1);
    expect(submitted.order!.items[0]!.estimatedReadyAt).toBeDefined();
    expect(submitted.session.status).toBe("occupied");
    await kitchen.markAllReady(restaurantId, submitted.order!.id);
    await orders.serveOrder(restaurantId, user.id, submitted.order!.id);
    const bill = await invoices.generateInvoice(restaurantId, user.id, submitted.order!.id, {});
    // Reproduces an interrupted flow where payment reaches the ledger before
    // the customer visit has been persisted. Checkout must rebuild and sync it.
    await CustomerVisit.deleteMany({ restaurantId, sessionId: guest.session.id });
    await payments.createPayment(restaurantId, { invoiceId: bill.id, payments: [{ mode: "cash", amount: bill.total }] });
    const customer = (await customers.listCustomers(restaurantId, "9876543210", 1)).customers[0];
    expect(customer).toMatchObject({ name: "Aarav", visitCount: 1, amountPaid: bill.total });
    expect((await dining.listSeating(restaurantId)).tables[0]!.chairs[0]!.status).toBe("cleaning");
    await dining.markDiningSessionAvailable(restaurantId, guest.session.id, user.id);
    const floor = await dining.listSeating(restaurantId);
    expect(floor.tables[0]!.chairs[0]!.status).toBe("available");
    expect(floor.tables[0]!.chairs[1]!.status).toBe("held");
  });
  it("half cancellation bills the accepted total exactly and closes the kitchen ticket", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    const result = await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "cancel-test", items: [{ menuItemId: dish.id, qty: 1 }] });
    await Order.updateOne({ _id: result.order!.id }, { $set: { placedAt: new Date(Date.now() - 9 * 60000), "items.$[].sentAt": new Date(Date.now() - 9 * 60000) } });
    await expect(dining.cancelOrder(restaurantId, hold.sessionToken, { reason: "Changed plans", acceptedChargePercent: 0 })).rejects.toMatchObject({ code: "CANCELLATION_QUOTE_CHANGED" });
    const cancelled = await dining.cancelOrder(restaurantId, hold.sessionToken, { reason: "Changed plans", acceptedChargePercent: 50 });
    expect(cancelled.order!.cancellation!.amountDue).toBe(5900);
    expect(await kitchen.listActiveTickets(restaurantId)).toHaveLength(0);
    const bill = await invoices.generateInvoice(restaurantId, user.id, result.order!.id, {});
    expect(bill.total).toBe(5900);
    expect(bill.subtotal).toBe(5000);
    expect(bill.taxLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "CGST", amount: 450 }),
      expect.objectContaining({ name: "SGST", amount: 450 }),
    ]));
    await expect(dining.releaseSession(restaurantId, hold.session.id, user.id, "Leave")).rejects.toMatchObject({ code: "PAYMENT_PENDING" });
  });
  it("adds independent QR batches idempotently and assigns an active waiter", async () => {
    const { restaurantId, table, dish } = await setup();
    const secondDish = await createTestMenuItem(restaurantId, { name: "Dessert", price: 16000 });
    const ingredient = await createTestInventoryItem(restaurantId, { currentStock: 10 });
    dish.ingredientMapping = [{ inventoryItemId: ingredient._id, quantityPerUnit: 0.5 }];
    secondDish.ingredientMapping = [{ inventoryItemId: ingredient._id, quantityPerUnit: 0.25 }];
    await Promise.all([dish.save(), secondDish.save()]);
    const { user: waiter } = await createTestStaff(restaurantId, "server");
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    const first = await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "first-batch", items: [{ menuItemId: dish.id, qty: 1 }] });
    const addInput = { idempotencyKey: "dessert-batch", items: [{ menuItemId: secondDish.id, qty: 1 }] };
    await dining.submitOrder(restaurantId, hold.sessionToken, addInput);
    const repeated = await dining.submitOrder(restaurantId, hold.sessionToken, addInput);
    expect(await Order.countDocuments({ restaurantId })).toBe(1);
    expect(await Kot.countDocuments({ restaurantId })).toBe(2);
    expect((await InventoryItem.findById(ingredient.id))!.currentStock).toBe(9.25);
    expect(await InventoryTransaction.countDocuments({ restaurantId, itemId: ingredient.id, type: "deduction" })).toBe(2);
    expect(repeated.order!.items).toHaveLength(2);
    expect(repeated.session.assignedWaiter).toEqual({ id: waiter.id, name: waiter.name });
    expect(repeated.order!.assignedWaiter).toEqual({ id: waiter.id, name: waiter.name });
    expect(repeated.bill).toMatchObject({ itemsSubtotal: 26000, activeItemsSubtotal: 26000, totalDue: 30680, paymentDue: 30680 });
    expect(repeated.bill!.taxLines).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "CGST", ratePercent: 9, amount: 2340 }),
      expect.objectContaining({ name: "SGST", ratePercent: 9, amount: 2340 }),
    ]));
    await expect(dining.submitOrder(restaurantId, hold.sessionToken, { ...addInput, items: [{ menuItemId: dish.id, qty: 1 }] })).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(first.canAddItems).toBe(true);
  });
  it("cancels selected quantities using each line's own clock and retains staff-visible history", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const newDish = await createTestMenuItem(restaurantId, { name: "Fresh add-on", price: 16000 });
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "older-batch", items: [{ menuItemId: dish.id, qty: 1 }] });
    await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "newer-batch", items: [{ menuItemId: newDish.id, qty: 1 }] });
    const stored = await Order.findOne({ restaurantId })!;
    stored!.items[0]!.sentAt = new Date(Date.now() - 9 * 60000);
    await stored!.save();
    const selections = stored!.items.map((item) => ({ orderItemId: item.id, qty: 1 }));
    const quote = await dining.quoteCancellation(restaurantId, hold.sessionToken, { items: selections });
    expect(quote.lines.map((line) => line.chargePercent)).toEqual([50, 0]);
    expect(quote.totals).toMatchObject({ selectedSubtotal: 26000, baseCharge: 5000, amountDue: 5900 });
    const cancellationInput = { idempotencyKey: "cancel-selection", reason: "Only cancel selected dishes", items: quote.lines.map((line) => ({ orderItemId: line.orderItemId, qty: line.qty, acceptedChargePercent: line.chargePercent })) };
    const cancelled = await dining.cancelOrder(restaurantId, hold.sessionToken, cancellationInput);
    await dining.cancelOrder(restaurantId, hold.sessionToken, cancellationInput);
    expect(cancelled.order!.items.every((item) => item.cancelledQty === 1)).toBe(true);
    expect(cancelled.order!.cancellations).toHaveLength(1);
    expect((await Order.findById(cancelled.order!.id))!.cancellations).toHaveLength(1);
    expect(cancelled.bill).toMatchObject({ activeItemsSubtotal: 0, cancelledItemsSubtotal: 26000, cancellationBaseCharge: 5000, cancellationCharge: 5900, totalDue: 5900 });
    const staffOrder = await orders.getOrder(restaurantId, cancelled.order!.id);
    expect(staffOrder.cancellations?.[0]?.lines).toHaveLength(2);
    const invoice = await invoices.generateInvoice(restaurantId, user.id, cancelled.order!.id, {});
    expect(invoice.total).toBe(5900);
    expect(invoice.subtotal).toBe(5000);
  });
  it("marks complete table bookings distinctly and keeps every chair blocked while cleaning", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const seats = Array.from({ length: table.seatingCapacity }, (_, index) => ({ tableId: table.id, chairNumber: index + 1 }));
    const hold = await dining.holdSeats(restaurantId, { partySize: 4, seats, bookingMode: "whole_table", customer: { name: "Family", phone: "9876543210" } });
    let seating = await dining.listSeating(restaurantId);
    expect(seating.tables[0]).toMatchObject({ bookingMode: "whole_table", wholeTableOccupied: false });
    const submitted = await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "family-order", items: [{ menuItemId: dish.id, qty: 1 }] });
    seating = await dining.listSeating(restaurantId);
    expect(seating.tables[0]).toMatchObject({ wholeTableOccupied: true });
    await kitchen.markAllReady(restaurantId, submitted.order!.id);
    await orders.serveOrder(restaurantId, user.id, submitted.order!.id);
    const invoice = await invoices.generateInvoice(restaurantId, user.id, submitted.order!.id, {});
    await payments.createPayment(restaurantId, { invoiceId: invoice.id, payments: [{ mode: "cash", amount: invoice.total }] });
    seating = await dining.listSeating(restaurantId);
    expect(seating.tables[0]).toMatchObject({ wholeTableCleaning: true });
    expect(seating.tables[0]!.chairs.every((chair) => chair.status === "cleaning")).toBe(true);
    await dining.markDiningSessionAvailable(restaurantId, hold.session.id, user.id);
    expect((await dining.listSeating(restaurantId)).tables[0]!.chairs.every((chair) => chair.status === "available")).toBe(true);
  });
  it("protects chair parties from legacy table mutations and orders, and supports staff session drafts", async () => {
    const { restaurantId, table, user } = await setup();
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }] }, user.id);
    await expect(orders.createOrder(restaurantId, user.id, table.id)).rejects.toMatchObject({ code: "CHAIR_SESSION_ACTIVE" });
    await expect(tables.updateTableStatus(restaurantId, table.id, "free")).rejects.toMatchObject({ code: "CHAIR_SESSION_ACTIVE" });
    await expect(tables.deleteTable(restaurantId, table.id)).rejects.toMatchObject({ code: "CHAIR_SESSION_ACTIVE" });
    const result = await dining.staffSessionOrder(restaurantId, hold.session.id, user.id);
    expect(result.order.diningSessionId).toBe(hold.session.id);
    expect(result.order.status).toBe("draft");
  });
  it("serializes a legacy full-table claim against a chair reservation", async () => {
    const { restaurantId, table, user } = await setup();
    const results = await Promise.allSettled([
      orders.createOrder(restaurantId, user.id, table.id),
      dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  });
  it("validates public requests, isolates sessions by tenant and guards staff policy", async () => {
    const { restaurantId, table, user } = await setup();
    const app = createApp();
    const context = await request(app).get(`/api/public/dining/${table.qrToken}~1/context`);
    expect(context.status).toBe(200);
    expect(context.body.scanned.chairNumber).toBe(1);
    expect(JSON.stringify(context.body)).not.toContain("tokenHash");
    expect((await request(app).get(`/api/public/dining/${table.qrToken}/session`)).status).toBe(401);
    expect((await request(app).post(`/api/public/dining/${table.qrToken}/holds`).send({ partySize: 1, seats: [{ tableId: "bad", chairNumber: 1 }] })).status).toBe(400);
    expect((await request(app).patch("/api/dining/policy").send(DEFAULT_DINING_POLICY)).status).toBe(401);
    const other = await createTestRestaurant();
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    await expect(dining.getSession(other.id, hold.sessionToken)).rejects.toMatchObject({ code: "DINING_SESSION_INVALID" });
    expect((await request(app).patch("/api/dining/policy").set("Authorization", `Bearer ${tokenFor(user)}`).send({ ...DEFAULT_DINING_POLICY, freeCancellationMinutes: 20 })).status).toBe(400);
  });
});
