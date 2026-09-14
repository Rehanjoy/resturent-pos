import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestTable, createTestMenuItem, tokenFor } from "./utils/fixtures";
import * as dining from "../src/services/dining.service";
import * as orders from "../src/services/order.service";
import * as tables from "../src/services/table.service";
import * as kitchen from "../src/services/kitchen.service";
import * as invoices from "../src/services/invoice.service";
import * as payments from "../src/services/payment.service";
import { DiningFloor, DEFAULT_DINING_POLICY } from "../src/models/dining-floor.model";
import { Order } from "../src/models/order.model";
import { Kot } from "../src/models/kot.model";
import { createApp } from "../src/app";

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
  it("creates one real order and KOT on retried submit with ETA; counter payment does not free another party", async () => {
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
    await payments.createPayment(restaurantId, { invoiceId: bill.id, payments: [{ mode: "cash", amount: bill.total }] });
    expect((await dining.listSeating(restaurantId)).tables[0]!.chairs[0]!.status).toBe("occupied");
    await dining.releaseSession(restaurantId, guest.session.id, user.id, "Guest paid and left");
    const floor = await dining.listSeating(restaurantId);
    expect(floor.tables[0]!.chairs[0]!.status).toBe("available");
    expect(floor.tables[0]!.chairs[1]!.status).toBe("held");
  });
  it("half cancellation bills the accepted total exactly and closes the kitchen ticket", async () => {
    const { restaurantId, table, dish, user } = await setup();
    const hold = await dining.holdSeats(restaurantId, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: "Aarav", phone: "9876543210" } });
    const result = await dining.submitOrder(restaurantId, hold.sessionToken, { idempotencyKey: "cancel-test", items: [{ menuItemId: dish.id, qty: 1 }] });
    await Order.updateOne({ _id: result.order!.id }, { $set: { placedAt: new Date(Date.now() - 9 * 60000) } });
    await expect(dining.cancelOrder(restaurantId, hold.sessionToken, { reason: "Changed plans", acceptedChargePercent: 0 })).rejects.toMatchObject({ code: "CANCELLATION_QUOTE_CHANGED" });
    const cancelled = await dining.cancelOrder(restaurantId, hold.sessionToken, { reason: "Changed plans", acceptedChargePercent: 50 });
    expect(cancelled.order!.cancellation!.amountDue).toBe(5900);
    expect(await kitchen.listActiveTickets(restaurantId)).toHaveLength(0);
    const bill = await invoices.generateInvoice(restaurantId, user.id, result.order!.id, {});
    expect(bill.total).toBe(5900);
    expect(bill.taxLines).toHaveLength(0);
    await expect(dining.releaseSession(restaurantId, hold.session.id, user.id, "Leave")).rejects.toMatchObject({ code: "PAYMENT_PENDING" });
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
