import { deductInventoryForSentItems } from "../src/services/inventory-deduction.service";
import { MenuItem } from "../src/models/menu-item.model";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestStaff, createTestInventoryItem, createTestMenuItem } from "./utils/fixtures";
import { Types } from "mongoose";
import { InventoryTransaction } from "../src/models/inventory-transaction.model";
import { InventoryItem } from "../src/models/inventory-item.model";
import { inventoryReportingDay, getDailyInventoryActivity } from "../src/services/inventory-reporting.service";
import { adjustInventoryItem, listInventoryItems, updateInventoryItem } from "../src/services/inventory-item.service";
import { adjustInventoryItemSchema, updateInventoryItemSchema } from "../src/validators/inventory-item.validators";

describe("Inventory daily reporting and movement safeguards", () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  async function setup() {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant.id;
    const { user } = await createTestStaff(restaurantId, "manager");
    const item = await createTestInventoryItem(restaurantId, { currentStock: 10, reorderThreshold: 2 });
    return { restaurantId, staffId: user.id, itemId: item.id };
  }

  it("uses India midnight boundaries, including the UTC previous evening", () => {
    expect(inventoryReportingDay(new Date("2026-09-10T18:29:59Z"))).toEqual({
      start: new Date("2026-09-09T18:30:00Z"), end: new Date("2026-09-10T18:30:00Z"),
    });
    expect(inventoryReportingDay(new Date("2026-09-10T18:30:00Z")).start).toEqual(new Date("2026-09-10T18:30:00Z"));
  });

  it("separates received, consumed, wasted and corrected quantities without counting opening stock", async () => {
    const { restaurantId, staffId, itemId } = await setup();
    for (const input of [
      { movementType: "restock" as const, quantityDelta: 20 },
      { movementType: "usage" as const, quantityDelta: -3 },
      { movementType: "wastage" as const, quantityDelta: -2 },
      { movementType: "adjustment" as const, quantityDelta: -1 },
    ]) await adjustInventoryItem(restaurantId, staffId, itemId, { ...input, reason: "Daily entry" });
    await InventoryTransaction.create({ restaurantId, itemId, staffId, type: "deduction", quantityDelta: -4 });
    const activity = await getDailyInventoryActivity(restaurantId);
    expect(activity.get(itemId)).toEqual({ received: 20, used: 7, wasted: 2, corrected: -1 });
  });

  it("includes the start instant, excludes the end instant and isolates restaurants", async () => {
    const { restaurantId, itemId } = await setup();
    const other = await createTestRestaurant();
    await InventoryTransaction.collection.insertMany([
      { restaurantId: new Types.ObjectId(restaurantId), itemId: new Types.ObjectId(itemId), type: "usage", quantityDelta: -2, createdAt: new Date("2026-09-09T18:30:00Z") },
      { restaurantId: new Types.ObjectId(restaurantId), itemId: new Types.ObjectId(itemId), type: "usage", quantityDelta: -10, createdAt: new Date("2026-09-10T18:30:00Z") },
      { restaurantId: other._id, itemId: new Types.ObjectId(itemId), type: "usage", quantityDelta: -50, createdAt: new Date("2026-09-10T10:00:00Z") },
    ]);
    const activity = await getDailyInventoryActivity(restaurantId, new Date("2026-09-10T12:00:00Z"));
    expect(activity.get(itemId)?.used).toBe(2);
  });

  it("computes coverage, flags threshold equality and reports critical shortage with zero coverage", async () => {
    const { restaurantId, staffId, itemId } = await setup();
    const configured = await updateInventoryItem(restaurantId, staffId, itemId, { expectedDailyUsage: 2 });
    expect(configured.daysRemaining).toBe(5);
    expect(configured.stockAlert).toBe("healthy");
    const low = await adjustInventoryItem(restaurantId, staffId, itemId, { quantityDelta: -8, reason: "Unmapped usage", movementType: "usage" });
    expect(low.stockAlert).toBe("warning");
    expect(low.daysRemaining).toBe(1);
    const critical = await adjustInventoryItem(restaurantId, staffId, itemId, { quantityDelta: -3, reason: "Physical count" });
    expect(critical.stockAlert).toBe("critical");
    expect(critical.daysRemaining).toBe(0);
    await updateInventoryItem(restaurantId, staffId, itemId, { expectedDailyUsage: 0 });
    expect((await listInventoryItems(restaurantId, {}))[0]?.daysRemaining).toBeNull();
  });

  it("rejects negative daily usage and wrong-direction receipts or usage at the edge and service", async () => {
    expect(updateInventoryItemSchema.safeParse({ expectedDailyUsage: -1 }).success).toBe(false);
    expect(adjustInventoryItemSchema.safeParse({ movementType: "restock", quantityDelta: -1, reason: "Delivery" }).success).toBe(false);
    expect(adjustInventoryItemSchema.safeParse({ movementType: "usage", quantityDelta: 1, reason: "Usage" }).success).toBe(false);
    const { restaurantId, staffId, itemId } = await setup();
    await expect(adjustInventoryItem(restaurantId, staffId, itemId, { movementType: "restock", quantityDelta: -1, reason: "Bad receipt" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect((await InventoryItem.findById(itemId))?.currentStock).toBe(10);
    expect(await InventoryTransaction.countDocuments({ restaurantId })).toBe(0);
  });

  it("preserves simultaneous stock increments instead of losing a delivery", async () => {
    const { restaurantId, staffId, itemId } = await setup();
    await Promise.all([2, 3, 5].map((quantityDelta) => adjustInventoryItem(restaurantId, staffId, itemId, { quantityDelta, reason: "Delivery", movementType: "restock" })));
    expect((await InventoryItem.findById(itemId))?.currentStock).toBe(20);
    expect((await getDailyInventoryActivity(restaurantId)).get(itemId)?.received).toBe(10);
  });
  it("replays a QR batch once, aggregates shared ingredients and repairs a ledger failure using the saved recipe", async () => {
    const { restaurantId, itemId } = await setup();
    const dish = await createTestMenuItem(restaurantId);
    await MenuItem.updateOne({ _id: dish._id }, { ingredientMapping: [{ inventoryItemId: itemId, quantityPerUnit: 2 }] });
    const orderId = new Types.ObjectId().toString();
    const lines = [{ menuItemId: dish.id, qty: 1 }, { menuItemId: dish.id, qty: 2 }];
    const ledgerFailure = vi.spyOn(InventoryTransaction, "updateOne").mockRejectedValueOnce(new Error("Simulated ledger interruption"));
    await expect(deductInventoryForSentItems(restaurantId, undefined, orderId, lines, `qr:${orderId}`)).rejects.toThrow("Simulated ledger interruption");
    ledgerFailure.mockRestore();
    expect((await InventoryItem.findById(itemId))?.currentStock).toBe(4);
    await MenuItem.updateOne({ _id: dish._id }, { ingredientMapping: [{ inventoryItemId: itemId, quantityPerUnit: 9 }] });
    await deductInventoryForSentItems(restaurantId, undefined, orderId, lines, `qr:${orderId}`);
    await deductInventoryForSentItems(restaurantId, undefined, orderId, lines, `qr:${orderId}`);
    expect((await InventoryItem.findById(itemId))?.currentStock).toBe(4);
    const ledger = await InventoryTransaction.find({ restaurantId, relatedOrderId: orderId });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.quantityDelta).toBe(-6);
    expect(ledger[0]?.staffId).toBeUndefined();
  });

});
