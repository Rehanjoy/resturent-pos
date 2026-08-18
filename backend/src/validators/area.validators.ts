import { z } from "zod";

export const createAreaSchema = z.object({
  name: z.string().trim().min(1, "Area name is required.").max(80),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateAreaSchema = createAreaSchema.partial();

export const areaIdParamsSchema = z.object({
  id: z.string().min(1, "Area id is required."),
});
