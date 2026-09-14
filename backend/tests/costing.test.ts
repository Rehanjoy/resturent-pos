import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { Types } from "mongoose";
import { createApp } from "../src/app";
import { clearTestDb, connectTestDb, disconnectTestDb } from "./utils/test-db";
import { createTestRestaurant, createTestInventoryItem, createTestMenuItem, createTestStaff, createTestTable, tokenFor } from "./utils/fixtures";
import { calculateDishCost, costingOverview, ingredientCostHistory, simulateDishCost } from "../src/services/costing.service";
import { DEFAULT_COSTING_SETTINGS as settings, DEFAULT_DISH_COST_CONFIG as config } from "../src/models/costing.model";
import { saveRecipe } from "../src/services/production.service";
import { updateInventoryItem } from "../src/services/inventory-item.service";
import { InventoryItem } from "../src/models/inventory-item.model";
import { Order } from "../src/models/order.model";
describe("Dish costing arithmetic", () => {
 const ids = [new Types.ObjectId(), new Types.ObjectId(), new Types.ObjectId()];
 const ingredients = ids.map(_id => ({ _id, name: "Spice", unit: "kg", costPerUnit: 1 }));
 const dish = { _id: new Types.ObjectId(), name: "Dish", price: 10, recipeYield: 3, ingredientMapping: ids.map(inventoryItemId => ({ inventoryItemId, quantityPerUnit: 0.333333, quantityPerRecipe: 1 })) };
 it("sums exact thirds before rounding instead of losing one paise across three ingredients", () => {
   const result = calculateDishCost(dish, ingredients, settings, config);
   expect(result.ingredients.map(row => row.costPaise)).toEqual([0, 0, 0]);
   expect(result.foodCostPaise).toBe(1);
   expect(result.totalCostPaise).toBe(1);
 });
 it("keeps 1 gram contributions and distinguishes loss from margin targets", () => {
   const recipe = { ...dish, recipeYield: 1, price: 90, ingredientMapping: [{ inventoryItemId: ids[0], quantityPerUnit: 0.001 }] };
   const rice = [{ ...ingredients[0], costPerUnit: 100000 }];
   expect(calculateDishCost(recipe, rice, settings, config)).toMatchObject({ foodCostPaise: 100, profitPaise: -10, status: "loss" });
   expect(calculateDishCost({ ...recipe, price: 110 }, rice, settings, config).status).toBe("low_margin");
   expect(calculateDishCost({ ...recipe, price: 300 }, rice, settings, config).status).toBe("healthy");
 });
 it("allocates food-based overhead, waste, extras and derives a price satisfying both targets", () => {
   const result = calculateDishCost({ ...dish, price: 1000 }, ingredients.map(row => ({ ...row, costPerUnit: 100 })), { ...settings, overheadPercent: 100, wastagePercent: 10 }, { ...config, laborPaise: 10 });
   expect(result).toMatchObject({ foodCostPaise: 100, wastagePaise: 10, overheadPaise: 100, totalCostPaise: 220, breakEvenPaise: 220, suggestedPricePaise: 286 });
 });
 it("marks missing recipes and zero rates incomplete and labels seasonal advice from configured months", () => {
   expect(calculateDishCost({ ...dish, ingredientMapping: [] }, ingredients, settings, config).status).toBe("incomplete");
   const result = calculateDishCost(dish, ingredients.map(row => ({ ...row, costPerUnit: 0 })), settings, { ...config, seasonalMonths: [1] }, 3, 9);
   expect(result).toMatchObject({ status: "incomplete", recentEstimatedProfitPaise: null, inSeason: false });
 });
});
describe("Costing tenant boundaries, settings and simulation", () => {
 beforeAll(connectTestDb); afterAll(disconnectTestDb); beforeEach(clearTestDb);
 const app = createApp();
 it("validates settings, gates management roles and isolates tenant recipes and history", async () => {
   const restaurant = await createTestRestaurant(); const other = await createTestRestaurant();
   const { user: owner } = await createTestStaff(restaurant.id, "owner"); const { user: chef } = await createTestStaff(restaurant.id, "chef");
   const rice = await createTestInventoryItem(other.id);
   await request(app).get("/api/inventory/costing").expect(401);
   await request(app).patch("/api/inventory/costing/settings").set("Authorization", "Bearer " + tokenFor(chef)).send(settings).expect(403);
   await request(app).patch("/api/inventory/costing/settings").set("Authorization", "Bearer " + tokenFor(owner)).send({ ...settings, targetMarginPercent: 100 }).expect(400);
   const saved = await request(app).patch("/api/inventory/costing/settings").set("Authorization", "Bearer " + tokenFor(owner)).send({ ...settings, targetMarginPercent: 25 }).expect(200);
   expect(saved.body.targetMarginPercent).toBe(25);
   await request(app).get("/api/inventory/costing?days=366").set("Authorization", "Bearer " + tokenFor(owner)).expect(400);
   await expect(ingredientCostHistory(restaurant.id, rice.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
   expect((await costingOverview(other.id)).settings.targetMarginPercent).toBe(20);
 });
 it("simulates without mutation, audits actual rate edits and rejects linked unit changes", async () => {
   const restaurant = await createTestRestaurant(); const other = await createTestRestaurant();
   const { user } = await createTestStaff(restaurant.id, "owner");
   const rice = await createTestInventoryItem(restaurant.id, { unit: "kg", costPerUnit: 10000 }); const foreign = await createTestInventoryItem(other.id);
   const dish = await createTestMenuItem(restaurant.id);
   await saveRecipe(restaurant.id, dish.id, { yieldPortions: 10, ingredients: [{ inventoryItemId: rice.id, quantity: 2 }] });
   const simulated = await simulateDishCost(restaurant.id, { menuItemId: dish.id, ingredientRates: [{ inventoryItemId: rice.id, costPerUnit: 20000 }], sellingPricePaise: 3000 });
   expect(simulated).toMatchObject({ foodCostPaise: 4000, status: "loss" });
   expect((await InventoryItem.findById(rice.id))!.costPerUnit).toBe(10000);
   await expect(simulateDishCost(restaurant.id, { menuItemId: dish.id, ingredientRates: [{ inventoryItemId: foreign.id, costPerUnit: 1 }] })).rejects.toMatchObject({ code: "INVALID_INGREDIENT" });
   await expect(updateInventoryItem(restaurant.id, user.id, rice.id, { unit: "g" })).rejects.toMatchObject({ code: "INGREDIENT_UNIT_LOCKED" });
   await updateInventoryItem(restaurant.id, user.id, rice.id, { costPerUnit: 12000 });
   expect((await ingredientCostHistory(restaurant.id, rice.id)).history[0]).toMatchObject({ oldCostPerUnit: 10000, costPerUnit: 12000 });
 });
 it("counts only fulfilled non-cancelled order portions and labels current-cost estimates", async () => {
   const restaurant = await createTestRestaurant(); const table = await createTestTable(restaurant.id);
   const rice = await createTestInventoryItem(restaurant.id, { costPerUnit: 10000 }); const dish = await createTestMenuItem(restaurant.id);
   await saveRecipe(restaurant.id, dish.id, { yieldPortions: 1, ingredients: [{ inventoryItemId: rice.id, quantity: 0.1 }] });
   for (const status of ["closed", "served", "draft", "void"] as const) await Order.create({ restaurantId: restaurant.id, tableId: table.id, status, items: [{ menuItemId: dish.id, nameSnapshot: dish.name, priceSnapshot: 5000, qty: 2 }] });
   const overview = await costingOverview(restaurant.id);
   expect(overview.dishes[0].recentPortions).toBe(4);
   expect(overview.summary.estimateNote).toContain("not historical net profit");
 });
});
