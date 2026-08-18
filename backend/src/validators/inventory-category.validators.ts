import { z } from "zod";

export const createInventoryCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(80),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateInventoryCategorySchema = createInventoryCategorySchema.partial();

export const inventoryCategoryIdParamsSchema = z.object({
  id: z.string().min(1, "Inventory category id is required."),
});
