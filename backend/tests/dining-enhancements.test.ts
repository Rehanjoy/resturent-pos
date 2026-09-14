import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./utils/test-db";
import { createTestInventoryItem, createTestMenuItem, createTestRestaurant, createTestStaff, createTestTable } from "./utils/fixtures";
import * as dining from "../src/services/dining.service";
import * as serviceRequests from "../src/services/service-request.service";
import * as customers from "../src/services/customer.service";
import * as production from "../src/services/production.service";
import { InventoryTransaction } from "../src/models/inventory-transaction.model";
import { InventoryItem } from "../src/models/inventory-item.model";

describe("Customer visits and floor service", () => {
  beforeAll(connectTestDb); afterAll(disconnectTestDb); beforeEach(clearTestDb);
  it("requires identity, deduplicates open calls and never lets a guest target another chair", async () => {
    const restaurant = await createTestRestaurant(); const table = await createTestTable(restaurant.id); const { user } = await createTestStaff(restaurant.id, "server");
    await expect(dining.holdSeats(restaurant.id, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }] })).rejects.toMatchObject({ code: "CUSTOMER_REQUIRED" });
    const hold = await dining.holdSeats(restaurant.id, { partySize: 1, seats: [{ tableId: table.id, chairNumber: 1 }], customer: { name: " Asha ", phone: "98765 43210" } });
    expect(hold.session.customer).toEqual({ name: "Asha", phone: "+919876543210" });
    const first = await serviceRequests.createGuestServiceRequest(`${table.qrToken}~1`, hold.sessionToken, { type: "water" });
    const duplicate = await serviceRequests.createGuestServiceRequest(`${table.qrToken}~1`, hold.sessionToken, { type: "water" });
    expect(duplicate.id).toBe(first.id);
    await expect(serviceRequests.createGuestServiceRequest(`${table.qrToken}~1`, hold.sessionToken, { type: "help", seat: { tableId: table.id, chairNumber: 2 } })).rejects.toMatchObject({ code: "INVALID_SERVICE_SEAT" });
    expect(await serviceRequests.listStaffServiceRequests(restaurant.id)).toHaveLength(1);
    expect((await serviceRequests.updateServiceRequest(restaurant.id, first.id, user.id, "acknowledged")).status).toBe("acknowledged");
    await serviceRequests.updateServiceRequest(restaurant.id, first.id, user.id, "completed");
    expect(await serviceRequests.listStaffServiceRequests(restaurant.id)).toHaveLength(0);
    const listed = await customers.listCustomers(restaurant.id, "9876", 1);
    expect(listed.customers[0]).toMatchObject({ name: "Asha", visitCount: 1, serviceTag: "normal" });
  });
});

describe("Recipe production planning and reconciliation", () => {
  beforeAll(connectTestDb); afterAll(disconnectTestDb); beforeEach(clearTestDb);
  it("aggregates exact batch quantities and applies a closed-day measured difference once", async () => {
    const restaurant = await createTestRestaurant(); const { user } = await createTestStaff(restaurant.id, "inventory_manager");
    const rice = await createTestInventoryItem(restaurant.id, { name: "Basmati rice", unit: "kg", currentStock: 10, costPerUnit: 12000 });
    const oil = await createTestInventoryItem(restaurant.id, { name: "Oil", unit: "L", currentStock: 5, costPerUnit: 15000 });
    const biryani = await createTestMenuItem(restaurant.id, { name: "Biryani" });
    await production.saveRecipe(restaurant.id, biryani.id, { yieldPortions: 10, ingredients: [{ inventoryItemId: rice.id, quantity: 2 }, { inventoryItemId: oil.id, quantity: 0.5 }] });
    const plan = await production.saveProductionPlan(restaurant.id, { day: "2026-09-09", dishes: [{ menuItemId: biryani.id, portions: 25 }] });
    expect(plan.requirements.find(row => row.itemId === rice.id)).toMatchObject({ required: 5, shortage: 0, costPaise: 60000 });
    expect(plan.requirements.find(row => row.itemId === oil.id)).toMatchObject({ required: 1.25, shortage: 0 });
    await InventoryTransaction.create([{ restaurantId: restaurant.id, itemId: rice.id, type: "usage", quantityDelta: -4, reportingDay: "2026-09-09", staffId: user.id }, { restaurantId: restaurant.id, itemId: rice.id, type: "wastage", quantityDelta: -0.1, reportingDay: "2026-09-09", staffId: user.id }]);
    const fresh = await production.productionPlanDetail(restaurant.id, "2026-09-09"); const row = fresh.requirements.find(value => value.itemId === rice.id)!;
    const input = { actualUsed: 5.1, actualWasted: 0.2, expectedStock: row.currentStock, recordedUsed: row.recordedUsed, recordedWasted: row.recordedWasted };
    await production.reconcileProductionItem(restaurant.id, fresh.plan!.id, rice.id, user.id, input);
    await production.reconcileProductionItem(restaurant.id, fresh.plan!.id, rice.id, user.id, input);
    expect((await InventoryItem.findById(rice.id))!.currentStock).toBe(8.8);
    expect(await InventoryTransaction.countDocuments({ restaurantId: restaurant.id, reconciliationKey: { $exists: true } })).toBe(2);
  });
});
