import { z } from "zod";
import { inventoryQuantitySchema } from "./inventory-quantity.validators";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
export const productionDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const date = new Date(`${day}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}, "Choose a valid calendar date.");
export const productionQuerySchema = z.object({ day: productionDaySchema });
export const recipeParamsSchema = z.object({ id: objectId });
export const recipeInputSchema = z.object({
  yieldPortions: z.number().int().min(1).max(100000),
  ingredients: z.array(z.object({ inventoryItemId: objectId, quantity: inventoryQuantitySchema.refine((value) => value > 0) })).min(1).max(100),
}).refine((value) => new Set(value.ingredients.map((entry) => entry.inventoryItemId)).size === value.ingredients.length, "Each ingredient must appear once.");
export const productionPlanInputSchema = z.object({
  day: productionDaySchema,
  dishes: z.array(z.object({ menuItemId: objectId, portions: z.number().int().min(1).max(100000) })).min(1).max(100),
}).refine((value) => new Set(value.dishes.map((dish) => dish.menuItemId)).size === value.dishes.length, "Each dish must appear once.");
export const reconciliationParamsSchema = z.object({ id: objectId, itemId: objectId });
export const reconciliationInputSchema = z.object({ actualUsed: inventoryQuantitySchema, actualWasted: inventoryQuantitySchema });
export const reconciliationConfirmSchema = reconciliationInputSchema.extend({
  expectedStock: z.number().finite(), recordedUsed: inventoryQuantitySchema, recordedWasted: inventoryQuantitySchema,
});
