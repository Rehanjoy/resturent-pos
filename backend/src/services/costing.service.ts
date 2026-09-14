import { Types } from "mongoose";
import { MenuItem, type MenuItemDocument } from "../models/menu-item.model";
import { InventoryItem, type InventoryItemDocument } from "../models/inventory-item.model";
import { Order } from "../models/order.model";
import { CostingSettings, DishCostConfig, DEFAULT_COSTING_SETTINGS, DEFAULT_DISH_COST_CONFIG, type CostingSettingsInput, type DishCostConfigInput } from "../models/costing.model";
import { quantityToMicros } from "./inventory-quantity.service";
import { AppError } from "../utils/app-error";

// Rational arithmetic keeps fractional paise until a displayed total is rounded.
type Rational = { n: bigint; d: bigint };
const rational = (n: number | bigint, d: number | bigint = 1): Rational => {
 let numerator = BigInt(n); let denominator = BigInt(d);
 let divisor = numerator < 0n ? -numerator : numerator; let remainder = denominator;
 while (remainder) { const next = divisor % remainder; divisor = remainder; remainder = next; }
 numerator /= divisor; denominator /= divisor;
 return { n: numerator, d: denominator };
};
const add = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
function amount(value: Rational, ceil = false) {
  const result = Number(ceil ? (value.n + value.d - 1n) / value.d : (value.n * 2n + value.d) / (value.d * 2n));
  if (!Number.isSafeInteger(result)) throw new AppError("Cost exceeds the supported amount. Review recipe quantities.", 422, "COST_OVERFLOW");
  return result;
}
const percentRatio = (value: number) => rational(Math.round(value * 100), 10000);
function settingsDto(value?: Partial<CostingSettingsInput> | null): CostingSettingsInput {
  return Object.fromEntries(Object.entries(DEFAULT_COSTING_SETTINGS).map(([key, fallback]) => [key, value?.[key as keyof CostingSettingsInput] ?? fallback])) as unknown as CostingSettingsInput;
}
function configDto(value?: Partial<DishCostConfigInput> | null): DishCostConfigInput {
 return Object.fromEntries(Object.entries(DEFAULT_DISH_COST_CONFIG).map(([key, fallback]) => [key, value?.[key as keyof DishCostConfigInput] ?? fallback])) as unknown as DishCostConfigInput;
}
export function calculateDishCost(dish: Pick<MenuItemDocument, "_id" | "name" | "price" | "recipeYield" | "ingredientMapping">, inventory: Pick<InventoryItemDocument, "_id" | "name" | "unit" | "costPerUnit">[], settings: CostingSettingsInput, config: DishCostConfigInput, recentPortions = 0, month = new Date().getMonth() + 1) {
 let food = rational(0);
 let incomplete = !dish.ingredientMapping.length;
 const explanations: string[] = [];
 if (incomplete) explanations.push("Add a measured recipe to calculate this dish.");
 const ingredients = dish.ingredientMapping.map(row => {
   const item = inventory.find(value => value._id.toString() === row.inventoryItemId.toString());
   const yieldPortions = row.quantityPerRecipe === undefined ? 1 : dish.recipeYield ?? 1;
   const quantity = row.quantityPerRecipe ?? row.quantityPerUnit;
   const missing = !item || item.costPerUnit <= 0 || quantity <= 0;
   if (missing) incomplete = true;
   const cost = rational(BigInt(quantityToMicros(quantity)) * BigInt(item?.costPerUnit ?? 0), BigInt(1000000) * BigInt(yieldPortions));
   food = add(food, cost);
   return { inventoryItemId: row.inventoryItemId.toString(), name: item?.name ?? "Missing ingredient", unit: item?.unit ?? "", quantityPerBatch: row.quantityPerRecipe ?? row.quantityPerUnit * (dish.recipeYield ?? 1), quantityPerPortion: quantity / yieldPortions, costPerUnit: item?.costPerUnit ?? 0, costPaise: amount(cost), missing };
 });
 if (ingredients.some(row => row.missing)) explanations.push("One or more ingredients need a positive quantity and purchase rate. Cost is incomplete.");
 const wastage = multiply(food, percentRatio(config.wastagePercent ?? settings.wastagePercent));
 const overhead = settings.overheadMode === "monthly" ? rational(settings.monthlyOverheadPaise, settings.monthlyPortions) : multiply(food, percentRatio(settings.overheadPercent));
 const extraCostPaise = config.packagingPaise + config.laborPaise + config.utilitiesPaise + config.otherPaise;
 const total = add(add(add(food, wastage), overhead), rational(extraCostPaise));
 const totalCostPaise = amount(total);
 const profitPaise = dish.price - totalCostPaise;
 const marginPercent = dish.price > 0 ? Math.round(profitPaise / dish.price * 10000) / 100 : null;
 const foodCostPaise = amount(food);
 const foodCostPercent = dish.price > 0 ? amount(multiply(food, rational(10000, dish.price))) / 100 : null;
 const breakEvenPaise = amount(total, true);
 const suggestedPricePaise = Math.max(amount(multiply(food, rational(10000, Math.round(settings.targetFoodCostPercent * 100))), true), amount(multiply(total, rational(10000, 10000 - Math.round(settings.targetMarginPercent * 100))), true));
 const belowMarginTarget = total.n * 10000n > BigInt(dish.price) * total.d * BigInt(10000 - Math.round(settings.targetMarginPercent * 100));
 const aboveFoodTarget = food.n * 10000n > BigInt(dish.price) * food.d * BigInt(Math.round(settings.targetFoodCostPercent * 100));
 const status = incomplete ? "incomplete" : total.n > BigInt(dish.price) * total.d ? "loss" : dish.price === 0 || belowMarginTarget || aboveFoodTarget ? "low_margin" : "healthy";
 if (status === "loss") explanations.push("The current selling price is below estimated full cost.");
 if (status === "low_margin") explanations.push("The current price does not meet the configured food-cost or margin target.");
 if (status === "healthy") explanations.push("The current price meets both configured targets using current ingredient rates.");

 const inSeason = config.seasonalMonths.length ? config.seasonalMonths.includes(month) : null;
 if (inSeason === false) explanations.push("Outside your configured seasonal months. Check availability and purchase rates before promoting.");
 return { id: dish._id.toString(), name: dish.name, sellingPricePaise: dish.price, recipeYield: dish.recipeYield ?? 1, config, ingredients, foodCostPaise, wastagePaise: amount(wastage), overheadPaise: amount(overhead), extraCostPaise, totalCostPaise, profitPaise, marginPercent, foodCostPercent, breakEvenPaise, suggestedPricePaise, status, explanations, inSeason, recentPortions, recentEstimatedProfitPaise: incomplete ? null : profitPaise * recentPortions };
}
export async function costingOverview(restaurantId: string, days = 30) {
 const [stored, menu, inventory, configs, volumes] = await Promise.all([
  CostingSettings.findOne({ restaurantId }).lean(), MenuItem.find({ restaurantId }).sort({ name: 1 }).lean(),
  InventoryItem.find({ restaurantId }).sort({ name: 1 }).lean(), DishCostConfig.find({ restaurantId }).lean(),
  Order.aggregate<{ _id: Types.ObjectId; portions: number }>([
   { $match: { restaurantId: new Types.ObjectId(restaurantId), status: { $in: ["served", "billed", "closed"] }, cancellation: { $exists: false }, createdAt: { $gte: new Date(Date.now() - days * 86400000) } } },
   { $unwind: "$items" }, { $group: { _id: "$items.menuItemId", portions: { $sum: "$items.qty" } } },
  ]),
 ]);
 const settings = settingsDto(stored);
 const dishes = menu.map(dish => calculateDishCost(dish, inventory, settings, configDto(configs.find(value => value.menuItemId.toString() === dish._id.toString())), volumes.find(value => value._id.toString() === dish._id.toString())?.portions ?? 0));
 return { settings, dishes, ingredients: inventory.map(item => ({ id: item._id.toString(), name: item.name, categoryId: item.categoryId.toString(), unit: item.unit, costPerUnit: item.costPerUnit, currentStock: item.currentStock })), summary: { days, totalDishes: dishes.length, incompleteDishes: dishes.filter(row => row.status === "incomplete").length, lossDishes: dishes.filter(row => row.status === "loss").length, lowMarginDishes: dishes.filter(row => row.status === "low_margin").length, recentPortions: dishes.reduce((sum, row) => sum + row.recentPortions, 0), recentEstimatedProfitPaise: dishes.reduce((sum, row) => sum + (row.recentEstimatedProfitPaise ?? 0), 0), estimateNote: "Fulfilled order portions by order creation date, valued at today's menu price and ingredient rates. This is a current-cost estimate, not historical net profit; discounts, taxes and unentered operating costs are excluded. Incomplete recipes are excluded from estimated profit." } };
}
export async function saveCostingSettings(restaurantId: string, input: CostingSettingsInput) {
 return settingsDto(await CostingSettings.findOneAndUpdate({ restaurantId }, { $set: input }, { new: true, upsert: true, runValidators: true }).lean());
}
export async function saveDishCostConfig(restaurantId: string, menuItemId: string, input: DishCostConfigInput) {
 if (!await MenuItem.exists({ _id: menuItemId, restaurantId })) throw new AppError("Dish not found.", 404, "NOT_FOUND");
 return configDto(await DishCostConfig.findOneAndUpdate({ restaurantId, menuItemId }, { $set: input }, { new: true, upsert: true, runValidators: true }).lean());
}
export async function simulateDishCost(restaurantId: string, input: { menuItemId: string; sellingPricePaise?: number; ingredientRates: { inventoryItemId: string; costPerUnit: number }[] }) {
 const [dish, inventory, settings, config] = await Promise.all([MenuItem.findOne({ _id: input.menuItemId, restaurantId }).lean(), InventoryItem.find({ restaurantId }).lean(), CostingSettings.findOne({ restaurantId }).lean(), DishCostConfig.findOne({ restaurantId, menuItemId: input.menuItemId }).lean()]);
 if (!dish) throw new AppError("Dish not found.", 404, "NOT_FOUND");
 if (input.ingredientRates.some(row => !inventory.some(item => item._id.toString() === row.inventoryItemId) || !dish.ingredientMapping.some(item => item.inventoryItemId.toString() === row.inventoryItemId))) throw new AppError("Scenario rates must reference this dish's restaurant ingredients.", 400, "INVALID_INGREDIENT");
 return calculateDishCost({ ...dish, price: input.sellingPricePaise ?? dish.price }, inventory.map(item => ({ ...item, costPerUnit: input.ingredientRates.find(row => row.inventoryItemId === item._id.toString())?.costPerUnit ?? item.costPerUnit })), settingsDto(settings), configDto(config));
}
export async function ingredientCostHistory(restaurantId: string, itemId: string) {
 const item = await InventoryItem.findOne({ restaurantId, _id: itemId }).lean();
 if (!item) throw new AppError("Ingredient not found.", 404, "NOT_FOUND");
 const linked = await MenuItem.find({ restaurantId, "ingredientMapping.inventoryItemId": item._id }).select("name").lean();
 return { history: [...(item.priceHistory ?? [])].reverse().map(row => ({ oldCostPerUnit: row.oldCostPerUnit, costPerUnit: row.costPerUnit, changedAt: row.changedAt })), linkedDishes: linked.map(dish => ({ id: dish._id.toString(), name: dish.name })) };
}
