import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./utils/test-db";
import {
  createTestRestaurant,
  createTestStaff,
  createTestMenuItem,
  createTestTable,
  createTestInventoryItem,
} from "./utils/fixtures";
import * as orderService from "../src/services/order.service";
import * as inventoryItemService from "../src/services/inventory-item.service";
import * as inventoryCategoryService from "../src/services/inventory-category.service";
import { AppError } from "../src/utils/app-error";
import { InventoryItem } from "../src/models/inventory-item.model";
import { InventoryTransaction } from "../src/models/inventory-transaction.model";
import { MenuItem } from "../src/models/menu-item.model";

/**
 * PRD §3.9 Inventory Management: auto-deduction on send-to-kitchen must be
 * atomic and race-safe (PRD §4), never block service, and every manual
 * stock change must be fully audited. This suite exercises the deduction
 * side-effect wired into `order.service.ts` `sendToKitchen`, plus the
 * item/category CRUD and adjustment rules in `inventory-item.service.ts`.
 */
describe("Inventory management & auto-deduction", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  async function setupOrderWithMappedDish(overrides: {
    currentStock?: number;
    reorderThreshold?: number;
    quantityPerUnit?: number;
  }) {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: server } = await createTestStaff(restaurantId, "server");
    const table = await createTestTable(restaurantId);
    const ingredient = await createTestInventoryItem(restaurantId, {
      currentStock: overrides.currentStock ?? 10,
      reorderThreshold: overrides.reorderThreshold ?? 2,
    });
    const menuItem = await createTestMenuItem(restaurantId);
    await MenuItem.updateOne(
      { _id: menuItem._id },
      {
        ingredientMapping: [
          { inventoryItemId: ingredient._id, quantityPerUnit: overrides.quantityPerUnit ?? 2 },
        ],
      },
    );
    return { restaurantId, server, table, ingredient, menuItem };
  }

  it("deducts mapped ingredient stock atomically when items are sent to the kitchen", async () => {
    const { restaurantId, server, table, ingredient, menuItem } = await setupOrderWithMappedDish({
      currentStock: 10,
      quantityPerUnit: 2,
    });

    const { order } = await orderService.createOrder(
      restaurantId,
      server._id.toString(),
      table._id.toString(),
    );
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 3 }],
    });
    await orderService.sendToKitchen(restaurantId, order.id);

    const updated = await InventoryItem.findById(ingredient._id);
    expect(updated?.currentStock).toBe(4); // 10 - (2 per unit * 3 qty)

    const transactions = await InventoryTransaction.find({
      restaurantId,
      itemId: ingredient._id,
      type: "deduction",
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.quantityDelta).toBe(-6);
    expect(transactions[0]?.relatedOrderId?.toString()).toBe(order.id);
  });

  it("lets stock go negative rather than blocking the order when a decrement exceeds what's on hand", async () => {
    const { restaurantId, server, table, ingredient, menuItem } = await setupOrderWithMappedDish({
      currentStock: 1,
      reorderThreshold: 2,
      quantityPerUnit: 5,
    });

    const { order } = await orderService.createOrder(
      restaurantId,
      server._id.toString(),
      table._id.toString(),
    );
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 1 }],
    });

    const { order: sentOrder } = await orderService.sendToKitchen(restaurantId, order.id);
    expect(sentOrder.status).toBe("sent"); // order is not blocked by insufficient stock

    const updated = await InventoryItem.findById(ingredient._id);
    expect(updated?.currentStock).toBe(-4);
  });

  it("does not deduct anything for a dish with no ingredient mapping", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: server } = await createTestStaff(restaurantId, "server");
    const table = await createTestTable(restaurantId);
    const menuItem = await createTestMenuItem(restaurantId); // no ingredientMapping set

    const { order } = await orderService.createOrder(
      restaurantId,
      server._id.toString(),
      table._id.toString(),
    );
    await orderService.editOrderItems(restaurantId, order.id, {
      addItems: [{ menuItemId: menuItem._id.toString(), qty: 2 }],
    });

    const { order: sentOrder } = await orderService.sendToKitchen(restaurantId, order.id);
    expect(sentOrder.status).toBe("sent");

    const transactions = await InventoryTransaction.find({ restaurantId });
    expect(transactions).toHaveLength(0);
  });

  it("requires a non-empty reason for a manual stock adjustment", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: manager } = await createTestStaff(restaurantId, "manager");
    const ingredient = await createTestInventoryItem(restaurantId);

    await expect(
      inventoryItemService.adjustInventoryItem(
        restaurantId,
        manager._id.toString(),
        ingredient._id.toString(),
        { quantityDelta: -1, reason: "   " },
      ),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" } satisfies Partial<AppError>);

    const unchanged = await InventoryItem.findById(ingredient._id);
    expect(unchanged?.currentStock).toBe(10); // rejected before the stock mutation
  });

  it("records an audited adjustment transaction and updates stock in either direction", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: manager } = await createTestStaff(restaurantId, "manager");
    const ingredient = await createTestInventoryItem(restaurantId, { currentStock: 10 });

    const updated = await inventoryItemService.adjustInventoryItem(
      restaurantId,
      manager._id.toString(),
      ingredient._id.toString(),
      { quantityDelta: -3, reason: "Spoilage — dropped tray" },
    );
    expect(updated.currentStock).toBe(7);

    const transactions = await InventoryTransaction.find({
      restaurantId,
      itemId: ingredient._id,
      type: "adjustment",
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.reason).toBe("Spoilage — dropped tray");
    expect(transactions[0]?.quantityDelta).toBe(-3);
  });

  it("auto-clears the reorder-requested flag once a restock brings stock back above threshold", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: manager } = await createTestStaff(restaurantId, "manager");
    const ingredient = await createTestInventoryItem(restaurantId, {
      currentStock: 1,
      reorderThreshold: 5,
    });
    await InventoryItem.updateOne({ _id: ingredient._id }, { reorderRequested: true });

    const updated = await inventoryItemService.updateInventoryItem(
      restaurantId,
      manager._id.toString(),
      ingredient._id.toString(),
      { currentStock: 20 },
    );
    expect(updated.currentStock).toBe(20);
    expect(updated.reorderRequested).toBe(false);

    const transactions = await InventoryTransaction.find({
      restaurantId,
      itemId: ingredient._id,
      type: "restock",
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.quantityDelta).toBe(19);
  });

  it("does not clear the reorder-requested flag if the restock still leaves stock at or below threshold", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: manager } = await createTestStaff(restaurantId, "manager");
    const ingredient = await createTestInventoryItem(restaurantId, {
      currentStock: 1,
      reorderThreshold: 5,
    });
    await InventoryItem.updateOne({ _id: ingredient._id }, { reorderRequested: true });

    const updated = await inventoryItemService.updateInventoryItem(
      restaurantId,
      manager._id.toString(),
      ingredient._id.toString(),
      { currentStock: 4 }, // still <= reorderThreshold of 5
    );
    expect(updated.reorderRequested).toBe(true);
  });

  it("blocks reducing stock through the update endpoint (must use the audited adjustment action)", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const { user: manager } = await createTestStaff(restaurantId, "manager");
    const ingredient = await createTestInventoryItem(restaurantId, { currentStock: 10 });

    await expect(
      inventoryItemService.updateInventoryItem(
        restaurantId,
        manager._id.toString(),
        ingredient._id.toString(),
        { currentStock: 3 },
      ),
    ).rejects.toMatchObject({ code: "STOCK_DECREASE_NOT_ALLOWED" } satisfies Partial<AppError>);
  });

  it("toggles the reorder-requested status badge on demand", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const ingredient = await createTestInventoryItem(restaurantId);
    expect(ingredient.reorderRequested).toBe(false);

    const toggled = await inventoryItemService.toggleReorderRequested(
      restaurantId,
      ingredient._id.toString(),
    );
    expect(toggled.reorderRequested).toBe(true);

    const toggledBack = await inventoryItemService.toggleReorderRequested(
      restaurantId,
      ingredient._id.toString(),
    );
    expect(toggledBack.reorderRequested).toBe(false);
  });

  it("blocks deleting an inventory category that still has items in it", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    await createTestInventoryItem(restaurantId);
    const categories = await inventoryCategoryService.listInventoryCategories(restaurantId);
    const categoryId = categories[0]!.id;

    await expect(
      inventoryCategoryService.deleteInventoryCategory(restaurantId, categoryId),
    ).rejects.toMatchObject({ code: "CATEGORY_HAS_ITEMS" } satisfies Partial<AppError>);
  });

  it("blocks deleting an inventory item that's still mapped to a dish", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    const ingredient = await createTestInventoryItem(restaurantId);
    const menuItem = await createTestMenuItem(restaurantId);
    await MenuItem.updateOne(
      { _id: menuItem._id },
      { ingredientMapping: [{ inventoryItemId: ingredient._id, quantityPerUnit: 1 }] },
    );

    await expect(
      inventoryItemService.deleteInventoryItem(restaurantId, ingredient._id.toString()),
    ).rejects.toMatchObject({ code: "INVENTORY_ITEM_IN_USE" } satisfies Partial<AppError>);
  });

  it("finds items by a case-insensitive name search", async () => {
    const restaurant = await createTestRestaurant();
    const restaurantId = restaurant._id.toString();
    await createTestInventoryItem(restaurantId, { name: "Basmati Rice" });
    await createTestInventoryItem(restaurantId, { name: "Paneer" });

    const results = await inventoryItemService.listInventoryItems(restaurantId, {
      search: "rice",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("Basmati Rice");
  });
});
