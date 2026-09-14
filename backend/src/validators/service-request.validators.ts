import { z } from "zod";
const identifier = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier.");
export const serviceRequestBody = z.object({
  type: z.enum(["water", "bill", "help"]),
  seat: z.object({ tableId: identifier, chairNumber: z.number().int().min(1).max(100) }).strict().optional(),
  note: z.string().trim().max(160).optional(),
}).strict();
export const serviceRequestStatusBody = z.object({ status: z.enum(["acknowledged", "completed"]) }).strict();
export const serviceRequestIdParams = z.object({ id: identifier }).strict();
export const emptyServiceRequestQuery = z.object({}).strict();
export const serviceRequestToken = z.string().regex(/^[a-f0-9]{64}$/);
