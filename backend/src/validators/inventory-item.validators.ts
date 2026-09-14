import { inventoryQuantitySchema } from "./inventory-quantity.validators";
import { quantityToMicros } from "../services/inventory-quantity.service";
import { z } from "zod";

// Cost arrives already converted to paise (integer, smallest currency
// unit) — same convention as `menu-item.validators.ts` `priceSchema`.
const costPerUnitSchema = z
  .number()
  .int("Cost must be a whole number of paise (no decimals).")
  .min(0, "Cost can't be negative.");

export const createInventoryItemSchema = z.object({
  categoryId: z.string().min(1, "Category is required."),
  name: z.string().trim().min(1, "Item name is required.").max(120),
  unit: z.string().trim().min(1, "Unit is required.").max(20),
  costPerUnit: costPerUnitSchema,
  // Opening balance, defaults to 0 — can be fractional (e.g. 4.5 kg).
  currentStock: inventoryQuantitySchema.optional(),
  expectedDailyUsage: inventoryQuantitySchema.optional(),
  reorderThreshold: inventoryQuantitySchema.optional(),
  supplierId: z.string().min(1).optional(),
});

// `currentStock` is deliberately still accepted on update (it's how a
// restock gets recorded — see `inventory-item.service.ts`
// `updateInventoryItem`), but only ever as an increase; a decrease is
// rejected there with `STOCK_DECREASE_NOT_ALLOWED` so every reduction goes
// through the audited `/adjust` action with a mandatory reason instead.
export const updateInventoryItemSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  costPerUnit: costPerUnitSchema.optional(),
  currentStock: inventoryQuantitySchema.optional(),
  expectedDailyUsage: inventoryQuantitySchema.optional(),
  reorderThreshold: inventoryQuantitySchema.optional(),
  supplierId: z.string().min(1).optional(),
});

export const inventoryItemIdParamsSchema = z.object({
  id: z.string().min(1, "Inventory item id is required."),
});

export const inventoryItemListQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  // Name-contains, case-insensitive — powers the Inventory screen's search box.
  search: z.string().trim().max(120).optional(),
});

export const adjustInventoryItemSchema = z.object({
  movementType: z.enum(["restock", "usage", "wastage", "adjustment"]).optional(),
  quantityDelta: z
    .number().finite().refine((value) => { try { quantityToMicros(value); return true; } catch { return false; } }, "Use at most 6 decimal places, within 1,000,000 units.")
    .refine((value) => value !== 0, "Adjustment quantity can't be zero."),
  // Required — PRD §3.9 "Stock adjustment log (wastage, manual
  // correction) — fully audited."
  reason: z.string().trim().min(1, "A reason is required for a stock adjustment.").max(300),
}).refine((input) => input.movementType === "restock" ? input.quantityDelta > 0
  : input.movementType === "usage" || input.movementType === "wastage" ? input.quantityDelta < 0 : true,
  "Receipts must add stock; usage and wastage must remove stock.");
