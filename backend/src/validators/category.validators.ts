import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(80),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryIdParamsSchema = z.object({
  id: z.string().min(1, "Category id is required."),
});
