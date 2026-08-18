import { z } from "zod";

export const kotIdParamsSchema = z.object({
  kotId: z.string().min(1, "Ticket id is required."),
});

export const itemReadySchema = z.object({
  orderItemId: z.string().min(1, "Item id is required."),
});
