import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestMenuItem, createTestTable } from "./utils/fixtures";
import * as orderService from "../src/services/order.service";
import * as kitchenService from "../src/services/kitchen.service";
import * as invoiceService from "../src/services/invoice.service";
import * as paymentService from "../src/services/payment.service";
import { AppError } from "../src/utils/app-error";

/**
 * PRD §9: "billing calculations, inventory deduction, tax computation —
 * these must be 100% covered given financial impact." Inventory deduction
 * doesn't exist yet (Phase 2), so this suite covers billing + tax, the two
 * pieces of financial logic that do exist in this MVP — against a real
 * in-memory MongoDB and the actual service functions, not mocks.
 */
describe("Billing & Settlement — business logic", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function servedOrderFixture(priceInPaise = 10000) {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: cashier } = await createTestStaff(restaurantId, "cashier");
    const { user: owner } = await createTestStaff(restaurantId, "owner", {
      email: "owner@test.saffron.dev",
      password: "OwnerPass123!",
    });
    const menuItem = await createTestMenuItem(restaurantId, { price: priceInPaise });
    const table = await createTestTable(restaurantId);

    const { order } = await orderService.createOrder(restaurantId, cashier._id.toString(), table._id.toString());
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 2 }],
    });
    const { kot } = await orderService.sendToKitchen(restaurantId, order.id);
    await kitchenService.markAllReady(restaurantId, kot.id);
    const served = await orderService.serveOrder(restaurantId, cashier._id.toString(), order.id);

    return { restaurantId, restaurant, cashier, owner, order: served, subtotal: priceInPaise * 2 };
  }

  describe("tax computation", () => {
    it("computes CGST + SGST as two separate tax lines on the post-discount subtotal", async () => {
      const { restaurantId, order, subtotal, cashier } = await servedOrderFixture();

      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});

      expect(invoice.subtotal).toBe(subtotal); // 2 x ₹100.00 = ₹200.00 = 20000 paise
      expect(invoice.taxLines).toHaveLength(2);
      expect(invoice.taxLines.find((t) => t.name === "CGST")?.amount).toBe(1800); // 9% of 20000
      expect(invoice.taxLines.find((t) => t.name === "SGST")?.amount).toBe(1800); // 9% of 20000
      expect(invoice.total).toBe(subtotal + 1800 + 1800); // 20000 + 3600 = 23600
    });

    it("applies tax to the post-discount subtotal, not the pre-discount one", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();

      // 10% flat-type discount, well under the default 15% threshold — no
      // approval required.
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
        discount: { type: "percent", value: 10 },
      });

      // subtotal 20000, 10% discount = 2000, post-discount = 18000
      expect(invoice.discount?.amountApplied).toBe(2000);
      expect(invoice.taxLines.find((t) => t.name === "CGST")?.amount).toBe(1620); // 9% of 18000
      expect(invoice.total).toBe(18000 + 1620 + 1620); // 21240
    });
  });

  describe("discount calculation", () => {
    it("computes a percent discount as a share of the subtotal", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
        discount: { type: "percent", value: 5 },
      });
      expect(invoice.discount?.amountApplied).toBe(1000); // 5% of 20000
    });

    it("clamps a flat discount so the bill can never go negative", async () => {
      const { restaurantId, order, cashier, owner } = await servedOrderFixture(1000); // ₹10 item x2 = ₹20 subtotal
      // A discount clamped to 100% of the subtotal is, by definition, an
      // "effective percent" of 100 — well above the 15% threshold, so this
      // also exercises the approval path rather than being a bug in either
      // the clamp or the threshold check.
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
        discount: { type: "flat", value: 999_999 }, // absurdly large flat discount
        approverEmail: "owner@test.saffron.dev",
        approverPassword: "OwnerPass123!",
      });
      expect(invoice.discount?.amountApplied).toBe(2000); // clamped to the full subtotal, never negative
      expect(invoice.subtotal - (invoice.discount?.amountApplied ?? 0)).toBe(0);
      expect(invoice.discount?.approvedByStaffId).toBe(owner._id.toString());
    });

    it("requires manager approval above the configured threshold and rejects without it", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      await expect(
        invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
          discount: { type: "percent", value: 30 }, // over the 15% default threshold
        }),
      ).rejects.toMatchObject({ code: "DISCOUNT_APPROVAL_REQUIRED" } satisfies Partial<AppError>);
    });

    it("rejects an approval attempt with the wrong password", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      await expect(
        invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
          discount: { type: "percent", value: 30 },
          approverEmail: "owner@test.saffron.dev",
          approverPassword: "wrong-password",
        }),
      ).rejects.toMatchObject({ code: "DISCOUNT_APPROVAL_INVALID" } satisfies Partial<AppError>);
    });

    it("accepts a discount above threshold with valid owner credentials and records the approver", async () => {
      const { restaurantId, order, cashier, owner } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
        discount: { type: "percent", value: 30 },
        approverEmail: "owner@test.saffron.dev",
        approverPassword: "OwnerPass123!",
      });
      expect(invoice.discount?.approvedByStaffId).toBe(owner._id.toString());
    });

    it("does not require approval for a discount exactly at the threshold", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {
        discount: { type: "percent", value: 15 }, // exactly at threshold, not "exceeds"
      });
      expect(invoice.discount?.approvedByStaffId).toBeUndefined();
    });
  });

  describe("invoice numbering", () => {
    it("assigns strictly increasing, unique sequential numbers per restaurant", async () => {
      const { restaurantId, cashier } = await servedOrderFixture();
      // Generate three more served orders in the same restaurant to invoice.
      const numbers: number[] = [];
      for (let i = 0; i < 3; i++) {
        const table = await createTestTable(restaurantId);
        const menuItem = await createTestMenuItem(restaurantId);
        const { order } = await orderService.createOrder(restaurantId, cashier._id.toString(), table._id.toString());
        await orderService.editOrderItems(restaurantId, order.id, {
          addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
        });
        const { kot } = await orderService.sendToKitchen(restaurantId, order.id);
        await kitchenService.markAllReady(restaurantId, kot.id);
        const served = await orderService.serveOrder(restaurantId, cashier._id.toString(), order.id);
        const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), served.id, {});
        numbers.push(invoice.invoiceNumber);
      }
      const unique = new Set(numbers);
      expect(unique.size).toBe(numbers.length); // no collisions
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b)); // strictly increasing
    });

    it("assigns independent sequences per restaurant (no cross-tenant leakage)", async () => {
      const { restaurantId: restaurantA, order: orderA, cashier: cashierA } = await servedOrderFixture();
      const invoiceA = await invoiceService.generateInvoice(restaurantA, cashierA._id.toString(), orderA.id, {});

      const restaurantB = await createTestRestaurant();
      const { user: cashierB } = await createTestStaff(restaurantB._id.toString(), "cashier");
      const tableB = await createTestTable(restaurantB._id.toString());
      const menuItemB = await createTestMenuItem(restaurantB._id.toString());
      const { order: draftB } = await orderService.createOrder(
        restaurantB._id.toString(),
        cashierB._id.toString(),
        tableB._id.toString(),
      );
      await orderService.editOrderItems(restaurantB._id.toString(), draftB.id, {
        addItems: [{ menuItemId: menuItemB._id.toString(), qty: 1 }],
      });
      const { kot: kotB } = await orderService.sendToKitchen(restaurantB._id.toString(), draftB.id);
      await kitchenService.markAllReady(restaurantB._id.toString(), kotB.id);
      const servedB = await orderService.serveOrder(
        restaurantB._id.toString(),
        cashierB._id.toString(),
        draftB.id,
      );
      const invoiceB = await invoiceService.generateInvoice(
        restaurantB._id.toString(),
        cashierB._id.toString(),
        servedB.id,
        {},
      );

      // Both restaurants' first invoice gets #1 — sequences don't leak across tenants.
      expect(invoiceA.invoiceNumber).toBe(1);
      expect(invoiceB.invoiceNumber).toBe(1);
    });
  });

  describe("payment / settlement", () => {
    it("settles when split payments sum exactly to the invoice total", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});

      const half = Math.floor(invoice.total / 2);
      const result = await paymentService.createPayment(restaurantId, {
        invoiceId: invoice.id,
        payments: [
          { mode: "cash", amount: half },
          { mode: "upi", amount: invoice.total - half },
        ],
      });

      expect(result.order.status).toBe("closed");
      expect(result.payments.reduce((sum, p) => sum + p.amount, 0)).toBe(invoice.total);
    });

    it("rejects a payment whose lines don't sum exactly to the invoice total", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});

      await expect(
        paymentService.createPayment(restaurantId, {
          invoiceId: invoice.id,
          payments: [{ mode: "cash", amount: invoice.total - 1 }], // one paisa short
        }),
      ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" } satisfies Partial<AppError>);
    });

    it("rejects paying the same invoice twice", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});
      await paymentService.createPayment(restaurantId, {
        invoiceId: invoice.id,
        payments: [{ mode: "cash", amount: invoice.total }],
      });

      await expect(
        paymentService.createPayment(restaurantId, {
          invoiceId: invoice.id,
          payments: [{ mode: "cash", amount: invoice.total }],
        }),
      ).rejects.toMatchObject({ code: "INVOICE_ALREADY_PAID" } satisfies Partial<AppError>);
    });

    it("frees the table to needs_cleaning (not free) once payment is recorded", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});
      await paymentService.createPayment(restaurantId, {
        invoiceId: invoice.id,
        payments: [{ mode: "cash", amount: invoice.total }],
      });

      const { Table } = await import("../src/models/table.model");
      const table = await Table.findOne({ restaurantId, _id: order.tableId });
      expect(table?.status).toBe("needs_cleaning");
    });
  });

  describe("void flow", () => {
    it("reverts the order to served when voiding an unpaid (billed) invoice", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});

      const voided = await invoiceService.voidInvoice(restaurantId, cashier._id.toString(), invoice.id, "Wrong items rung up");
      expect(voided.status).toBe("void");

      const reopened = await orderService.getOrder(restaurantId, order.id);
      expect(reopened.status).toBe("served"); // back to served, ready for a corrected bill
    });

    it("does not reopen the order when voiding an already-paid invoice", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});
      await paymentService.createPayment(restaurantId, {
        invoiceId: invoice.id,
        payments: [{ mode: "cash", amount: invoice.total }],
      });

      await invoiceService.voidInvoice(restaurantId, cashier._id.toString(), invoice.id, "Customer complaint");

      const stillClosed = await orderService.getOrder(restaurantId, order.id);
      expect(stillClosed.status).toBe("closed"); // NOT reopened — money already changed hands
    });

    it("rejects voiding the same invoice twice", async () => {
      const { restaurantId, order, cashier } = await servedOrderFixture();
      const invoice = await invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {});
      await invoiceService.voidInvoice(restaurantId, cashier._id.toString(), invoice.id, "First void");

      await expect(
        invoiceService.voidInvoice(restaurantId, cashier._id.toString(), invoice.id, "Second void"),
      ).rejects.toMatchObject({ code: "INVOICE_ALREADY_VOID" } satisfies Partial<AppError>);
    });
  });

  describe("order-status guard", () => {
    it("refuses to bill an order that hasn't been served yet", async () => {
      const restaurant = await createTestRestaurant();
      const restaurantId = restaurant._id.toString();
      const { user: cashier } = await createTestStaff(restaurantId, "cashier");
      const table = await createTestTable(restaurantId);
      const { order } = await orderService.createOrder(restaurantId, cashier._id.toString(), table._id.toString());

      await expect(
        invoiceService.generateInvoice(restaurantId, cashier._id.toString(), order.id, {}),
      ).rejects.toMatchObject({ code: "ORDER_NOT_SERVED" } satisfies Partial<AppError>);
    });
  });
});
