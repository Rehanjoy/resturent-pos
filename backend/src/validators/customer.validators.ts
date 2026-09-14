import { z } from "zod";
const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid customer identifier.");
export const customerListQuery = z.object({ search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).max(10000).optional() }).strict();
export const customerIdParams = z.object({ id }).strict();
export const customerUpdateBody = z.object({
  serviceTag: z.enum(["normal", "good", "vip", "needs_attention"]),
  serviceNotes: z.string().trim().max(1000),
}).strict();
