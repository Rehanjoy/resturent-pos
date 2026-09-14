import { Types } from "mongoose";
import { MenuItem } from "../models/menu-item.model";
import { InventoryItem } from "../models/inventory-item.model";
import { InventoryTransaction } from "../models/inventory-transaction.model";
import { ProductionPlan, InventoryReconciliation } from "../models/production-plan.model";
import { AppError } from "../utils/app-error";
import { getDailyInventoryActivity } from "./inventory-reporting.service";
import { quantityFromMicros, quantityToMicros, quantityCostPaise, recipeRequirementMicros, stockMovementPipeline } from "./inventory-quantity.service";

type RecipeInput = { yieldPortions: number; ingredients: { inventoryItemId: string; quantity: number }[] };
type PlanInput = { day: string; dishes: { menuItemId: string; portions: number }[] };
export async function saveRecipe(restaurantId: string, menuItemId: string, input: RecipeInput) {
  const [dish, inventory] = await Promise.all([MenuItem.findOne({ _id: menuItemId, restaurantId }), InventoryItem.find({ _id: { $in: input.ingredients.map(row => row.inventoryItemId) }, restaurantId })]);
  if (!dish) throw new AppError("Dish not found.", 404, "NOT_FOUND");
  if (inventory.length !== input.ingredients.length) throw new AppError("One or more ingredients do not belong to this restaurant.", 400, "INVENTORY_ITEM_NOT_FOUND");
  dish.recipeYield = input.yieldPortions;
  dish.ingredientMapping = input.ingredients.map(row => ({ inventoryItemId: new Types.ObjectId(row.inventoryItemId), quantityPerRecipe: row.quantity, quantityPerUnit: quantityFromMicros(recipeRequirementMicros(row.quantity, 1, input.yieldPortions)) }));
  await dish.save();
  return { id: dish.id, name: dish.name, yieldPortions: dish.recipeYield, ingredients: dish.ingredientMapping.map(row => ({ inventoryItemId: row.inventoryItemId.toString(), quantity: row.quantityPerRecipe ?? row.quantityPerUnit })) };
}
async function buildRequirements(restaurantId: string, dishesInput: PlanInput["dishes"]) {
  const menu = await MenuItem.find({ _id: { $in: dishesInput.map(row => row.menuItemId) }, restaurantId }).lean();
  if (menu.length !== dishesInput.length) throw new AppError("One or more dishes were not found.", 400, "DISH_NOT_FOUND");
  const totals = new Map<string, number>();
  for (const row of dishesInput) {
    const dish = menu.find(item => item._id.toString() === row.menuItemId)!;
    if (!dish.ingredientMapping.length) throw new AppError(`${dish.name} needs a recipe before it can be planned.`, 409, "RECIPE_REQUIRED");
    for (const ingredient of dish.ingredientMapping) {
      const amount = recipeRequirementMicros(ingredient.quantityPerRecipe ?? ingredient.quantityPerUnit, row.portions, ingredient.quantityPerRecipe === undefined ? 1 : dish.recipeYield ?? 1);
      const key = ingredient.inventoryItemId.toString(); totals.set(key, (totals.get(key) ?? 0) + amount);
    }
  }
  const inventory = await InventoryItem.find({ _id: { $in: [...totals.keys()] }, restaurantId }).lean();
  if (inventory.length !== totals.size) throw new AppError("A recipe contains an unavailable inventory item.", 409, "RECIPE_INGREDIENT_MISSING");
  return { menu, requirements: inventory.map(item => ({ itemId: item._id.toString(), name: item.name, unit: item.unit, requiredMicros: totals.get(item._id.toString())!, costPaise: quantityCostPaise(totals.get(item._id.toString())!, item.costPerUnit) })) };
}
export async function saveProductionPlan(restaurantId: string, input: PlanInput) {
  const built = await buildRequirements(restaurantId, input.dishes);
  await ProductionPlan.findOneAndUpdate({ restaurantId, day: input.day }, { $set: { dishes: input.dishes.map(row => ({ ...row, name: built.menu.find(item => item._id.toString() === row.menuItemId)!.name })), requirements: built.requirements } }, { upsert: true, new: true, runValidators: true });
  return productionPlanDetail(restaurantId, input.day);
}
export async function productionPlanDetail(restaurantId: string, day: string) {
  const plan = await ProductionPlan.findOne({ restaurantId, day }).lean();
  if (!plan) return { plan: null, day, requirements: [], totalCostPaise: 0, note: "Planning is an estimate. Stock is deducted only when orders reach the kitchen." };
  const [inventory, activity, reconciliations] = await Promise.all([InventoryItem.find({ _id: { $in: plan.requirements.map(row => row.itemId) }, restaurantId }).lean(), getDailyInventoryActivity(restaurantId, new Date(`${day}T12:00:00+05:30`)), InventoryReconciliation.find({ restaurantId, planId: plan._id }).lean()]);
  const requirements = plan.requirements.map(row => { const item = inventory.find(value => value._id.toString() === row.itemId); const daily = activity.get(row.itemId) ?? { received: 0, used: 0, wasted: 0, corrected: 0 }; const reconciliation = reconciliations.find(value => value.itemId.toString() === row.itemId); return { ...row, required: quantityFromMicros(row.requiredMicros), currentStock: item?.currentStock ?? 0, shortage: Math.max(0, quantityFromMicros(row.requiredMicros) - (item?.currentStock ?? 0)), recordedUsed: daily.used, recordedWasted: daily.wasted, reconciled: Boolean(reconciliation?.appliedAt), actualUsed: reconciliation ? quantityFromMicros(reconciliation.actualUsedMicros) : null, actualWasted: reconciliation ? quantityFromMicros(reconciliation.actualWastedMicros) : null }; });
  return { plan: { id: plan._id.toString(), day: plan.day, dishes: plan.dishes, locked: plan.locked }, requirements, totalCostPaise: requirements.reduce((sum, row) => sum + row.costPaise, 0), note: "Planning is an estimate. Stock is deducted only when orders reach the kitchen." };
}
function currentIstDay() { return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); }
export async function reconcileProductionItem(restaurantId: string, planId: string, itemId: string, staffId: string, input: { actualUsed: number; actualWasted: number; expectedStock: number; recordedUsed: number; recordedWasted: number }) {
  const plan = await ProductionPlan.findOne({ _id: planId, restaurantId });
  if (!plan) throw new AppError("Production plan not found.", 404, "NOT_FOUND");
  if (plan.day >= currentIstDay()) throw new AppError("Close and reconcile this plan after its IST reporting day has ended.", 409, "DAY_NOT_CLOSED");
  if (!plan.requirements.some(row => row.itemId === itemId)) throw new AppError("This ingredient is not part of the selected production plan.", 400, "PLAN_INGREDIENT_NOT_FOUND");
  let reconciliation = await InventoryReconciliation.findOne({ restaurantId, planId, itemId });
  if (reconciliation?.appliedAt) {
    if (reconciliation.actualUsedMicros !== quantityToMicros(input.actualUsed) || reconciliation.actualWastedMicros !== quantityToMicros(input.actualWasted)) {
      throw new AppError("This ingredient was already reconciled with different measured values.", 409, "ALREADY_RECONCILED");
    }
    return productionPlanDetail(restaurantId, plan.day);
  }
  const item = await InventoryItem.findOne({ _id: itemId, restaurantId });
  if (!item) throw new AppError("Inventory item not found.", 404, "NOT_FOUND");
  if (quantityToMicros(item.currentStock) !== quantityToMicros(input.expectedStock)) throw new AppError("Stock changed. Refresh the plan before reconciling.", 409, "STOCK_CHANGED");
  const activity = await getDailyInventoryActivity(restaurantId, new Date(`${plan.day}T12:00:00+05:30`)); const recorded = activity.get(itemId) ?? { used: 0, wasted: 0 };
  if (quantityToMicros(recorded.used) !== quantityToMicros(input.recordedUsed) || quantityToMicros(recorded.wasted) !== quantityToMicros(input.recordedWasted)) throw new AppError("Daily usage changed. Refresh before reconciling.", 409, "ACTIVITY_CHANGED");
  if (!reconciliation) { try { const actualUsedMicros = quantityToMicros(input.actualUsed); const actualWastedMicros = quantityToMicros(input.actualWasted); reconciliation = await InventoryReconciliation.create({ restaurantId, planId, itemId, day: plan.day, actualUsedMicros, actualWastedMicros, usedDifferenceMicros: actualUsedMicros - quantityToMicros(recorded.used), wasteDifferenceMicros: actualWastedMicros - quantityToMicros(recorded.wasted), staffId }); } catch (error) { if ((error as { code?: number }).code !== 11000) throw error; reconciliation = await InventoryReconciliation.findOne({ restaurantId, planId, itemId }); } }
  if (!reconciliation) throw new AppError("Reconciliation could not be saved.", 409, "RECONCILIATION_BUSY");
  if (reconciliation.appliedAt) return productionPlanDetail(restaurantId, plan.day);
  const key = `reconcile:${reconciliation.id}`; const combined = reconciliation.usedDifferenceMicros + reconciliation.wasteDifferenceMicros;
  if (combined) await InventoryItem.updateOne({ _id: itemId, restaurantId, processedDeductionKeys: { $ne: key } }, stockMovementPipeline(-combined, key), { updatePipeline: true });
  for (const part of [{ suffix: "usage", type: "usage_correction", micros: reconciliation.usedDifferenceMicros }, { suffix: "waste", type: "waste_correction", micros: reconciliation.wasteDifferenceMicros }] as const) if (part.micros) await InventoryTransaction.updateOne({ restaurantId, reconciliationKey: `${key}:${part.suffix}` }, { $setOnInsert: { restaurantId, itemId, type: part.type, quantityDelta: quantityFromMicros(-part.micros), reason: `Measured ${part.suffix} reconciliation for ${plan.day}`, staffId, reportingDay: plan.day, reconciliationKey: `${key}:${part.suffix}` } }, { upsert: true });
  reconciliation.appliedAt = new Date(); await reconciliation.save(); plan.locked = true; await plan.save();
  return productionPlanDetail(restaurantId, plan.day);
}
