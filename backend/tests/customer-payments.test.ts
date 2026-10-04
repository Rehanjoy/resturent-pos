import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { Contact } from "../src/models/contact.model";
import { CustomerVisit } from "../src/models/customer-visit.model";
import { Order } from "../src/models/order.model";
import { Invoice } from "../src/models/invoice.model";
import { Payment } from "../src/models/payment.model";
import { customerDetail, listCustomers } from "../src/services/customer.service";

async function visitFixture(restaurantId = new Types.ObjectId(), name = "Aquib") {
  const contact = await Contact.create({ restaurantId, name, phone: `+91${Math.floor(6000000000 + Math.random() * 3000000000)}`, source: "order" });
  const visit = await CustomerVisit.create({ restaurantId, contactId: contact._id, sessionId: new Types.ObjectId().toString(), nameSnapshot: name, phoneSnapshot: contact.phone, partySize: 2, seats: [], source: "customer", status: "released", startedAt: new Date("2026-09-14T12:00:00Z"), endedAt: new Date("2026-09-14T12:30:00Z"), amountPaid: 0 });
  return { restaurantId, contact, visit };
}
async function paidOrder(restaurantId: Types.ObjectId, sessionId: string, amounts = [10000, 5340]) {
  const order = await Order.create({ restaurantId, tableId: new Types.ObjectId(), diningSessionId: sessionId, status: "closed", items: [] });
  const invoice = await Invoice.create({ restaurantId, orderId: order._id, invoiceNumber: Math.floor(Math.random() * 100000000), subtotal: amounts.reduce((a, b) => a + b, 0), total: amounts.reduce((a, b) => a + b, 0), createdByStaffId: new Types.ObjectId(), status: "issued" });
  await Payment.create(amounts.map((amount, index) => ({ restaurantId, invoiceId: invoice._id, mode: index ? "upi" : "cash", amount })));
  return { order, invoice };
}

describe("Customer ledger reads", () => {
  beforeAll(connectTestDb); afterAll(disconnectTestDb); beforeEach(clearTestDb); afterEach(() => vi.restoreAllMocks());

  it("recovers stale paid caches and deduplicates direct/session links and split payments without writes", async () => {
    const { restaurantId, contact, visit } = await visitFixture();
    const { order } = await paidOrder(restaurantId, visit.sessionId);
    await CustomerVisit.updateOne({ _id: visit._id }, { $set: { orderId: order._id, amountPaid: 12 } });
    const update = vi.spyOn(CustomerVisit, "updateMany");
    const bulk = vi.spyOn(CustomerVisit, "bulkWrite");
    const ledgerScan = vi.spyOn(Payment, "aggregate");
    for (let i = 0; i < 2; i++) {
      expect((await listCustomers(restaurantId.toString())).customers[0]!.amountPaid).toBe(15340);
      expect((await customerDetail(restaurantId.toString(), contact.id)).visits[0]!.amountPaid).toBe(15340);
    }
    expect((await CustomerVisit.findById(visit._id))!.amountPaid).toBe(12);
    expect(update).not.toHaveBeenCalled(); expect(bulk).not.toHaveBeenCalled(); expect(ledgerScan).not.toHaveBeenCalled();
  });

  it("finds historical payments when the visit has no orderId, including more than one order in a session", async () => {
    const { restaurantId, contact, visit } = await visitFixture();
    const { order } = await paidOrder(restaurantId, visit.sessionId, [1000]);
    const second = await paidOrder(restaurantId, visit.sessionId, [2000]);
    const detail = await customerDetail(restaurantId.toString(), contact.id);
    expect(detail.visits[0]!.amountPaid).toBe(3000);
    expect([order.id, second.order.id]).toContain(detail.visits[0]!.orderId);
    expect((await listCustomers(restaurantId.toString())).customers[0]!.amountPaid).toBe(3000);
  });

  it("keeps order, invoice and payment joins tenant-scoped", async () => {
    const { restaurantId, contact, visit } = await visitFixture();
    const { order, invoice } = await paidOrder(restaurantId, visit.sessionId, [700]);
    const foreignRestaurantId = new Types.ObjectId();
    await paidOrder(foreignRestaurantId, visit.sessionId, [90000]);
    await Payment.create({ restaurantId: foreignRestaurantId, invoiceId: invoice._id, mode: "cash", amount: 90000 });
    const foreignInvoice = await Invoice.create({ restaurantId: foreignRestaurantId, orderId: order._id, invoiceNumber: 99999, subtotal: 90000, total: 90000, createdByStaffId: new Types.ObjectId() });
    await Payment.create({ restaurantId, invoiceId: foreignInvoice._id, mode: "cash", amount: 90000 });
    expect((await customerDetail(restaurantId.toString(), contact.id)).visits[0]!.amountPaid).toBe(700);
    await expect(customerDetail(foreignRestaurantId.toString(), contact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("uses indexes for the selected visits and each ledger lookup", async () => {
    const { restaurantId, contact, visit } = await visitFixture();
    await paidOrder(restaurantId, visit.sessionId);
    await Promise.all([CustomerVisit.init(), Order.init(), Invoice.init(), Payment.init()]);
    const aggregation = vi.spyOn(CustomerVisit, "aggregate");
    await customerDetail(restaurantId.toString(), contact.id);
    const pipeline = aggregation.mock.calls[0]![0]!;
    aggregation.mockRestore();
    const explanation = await CustomerVisit.aggregate(pipeline).explain("executionStats");
    const lookupStages = explanation.stages.filter((stage: Record<string, unknown>) => stage.$lookup);
    expect(lookupStages).toHaveLength(3);
    for (const stage of lookupStages) {
      expect(Number(stage.collectionScans)).toBe(0);
      expect(stage.indexesUsed.length).toBeGreaterThan(0);
    }
  });

  it("projects expired holds without mutating them and preserves legacy amounts with no ledger", async () => {
    const { restaurantId, contact, visit } = await visitFixture();
    const expiresAt = new Date("2026-09-14T12:05:00Z");
    await CustomerVisit.updateOne({ _id: visit._id }, { $set: { status: "held", expiresAt, amountPaid: 1234 }, $unset: { endedAt: 1 } });
    const detail = await customerDetail(restaurantId.toString(), contact.id);
    expect(detail.visits[0]).toMatchObject({ status: "expired", durationMinutes: 5, amountPaid: 1234 });
    expect((await CustomerVisit.findById(visit._id))!.status).toBe("held");
  });

  it("limits ledger enrichment to the requested contact page and skips it for empty searches", async () => {
    const { restaurantId } = await visitFixture();
    for (let i = 0; i < 30; i++) await visitFixture(restaurantId, `Guest ${i}`);
    const aggregation = vi.spyOn(CustomerVisit, "aggregate");
    const page = await listCustomers(restaurantId.toString(), "", 2);
    expect(page.customers).toHaveLength(1);
    const firstStage = aggregation.mock.calls[0]![0]![0] as { $match: { contactId: { $in: Types.ObjectId[] } } };
    expect(firstStage.$match.contactId.$in.map(id => id.toString())).toEqual(page.customers.map(customer => customer.id));
    aggregation.mockClear();
    expect((await listCustomers(restaurantId.toString(), "No such guest")).customers).toEqual([]);
    expect(aggregation).not.toHaveBeenCalled();
  });
});
