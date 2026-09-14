import { z } from "zod";
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier.");
const money = z.number().int().min(0).max(100000000000);
const percent = z.number().min(0).max(100).multipleOf(0.01);
export const costingQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict();
export const costingParamsSchema = z.object({ id: objectId });
export const costingSettingsSchema = z.object({
 targetFoodCostPercent: percent.refine(value => value > 0), targetMarginPercent: percent.refine(value => value < 100),
 wastagePercent: percent, overheadMode: z.enum(["percentage", "monthly"]),
 overheadPercent: z.number().min(0).max(1000).multipleOf(0.01), monthlyOverheadPaise: money,
 monthlyPortions: z.number().int().min(1).max(10000000),
}).strict();
export const dishCostConfigSchema = z.object({
 packagingPaise: money, laborPaise: money, utilitiesPaise: money, otherPaise: money,
 wastagePercent: percent.nullable(), seasonalMonths: z.array(z.number().int().min(1).max(12)).max(12).refine(values => new Set(values).size === values.length).default([]),
}).strict();
export const costingSimulationSchema = z.object({
 menuItemId: objectId, sellingPricePaise: money.optional(),
 ingredientRates: z.array(z.object({ inventoryItemId: objectId, costPerUnit: money }).strict()).max(100).default([]),
}).strict().refine(value => new Set(value.ingredientRates.map(row => row.inventoryItemId)).size === value.ingredientRates.length, "Each ingredient rate must appear once.");
