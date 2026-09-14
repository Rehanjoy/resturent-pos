import { z } from "zod";
const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier.");
export const qrParams = z.object({ qrToken: z.string().regex(/^[a-f0-9]{32}(~[1-9][0-9]{0,2})?$/) });
export const idParams = z.object({ id });
export const etaParams = z.object({ id, itemId: id });
const customer = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().min(8).max(24) }).strict();
const holdFields = { partySize: z.number().int().min(1).max(50), bookingMode: z.enum(["whole_table", "chairs"]).optional(), seats: z.array(z.object({ tableId: id, chairNumber: z.number().int().min(1).max(100) }).strict()).min(1).max(100) };
export const holdBody = z.object({ ...holdFields, customer }).strict().refine(body => body.seats.length >= body.partySize, "Select a chair for every guest.");
export const staffHoldBody = z.object({ ...holdFields, customer: customer.optional() }).strict().refine(body => body.seats.length >= body.partySize, "Select a chair for every guest.");
export const orderBody = z.object({ idempotencyKey: z.string().min(8).max(100), items: z.array(z.object({ menuItemId: id, qty: z.number().int().min(1).max(50), notes: z.string().trim().max(300).optional() })).min(1).max(50) });
export const reasonBody = z.object({ reason: z.string().trim().min(1).max(300) });
const cancellationItem = z.object({ orderItemId: id, qty: z.number().int().min(1).max(50) }).strict();
export const cancellationQuoteBody = z.object({ items: z.array(cancellationItem).min(1).max(50) }).strict();
export const cancelBody = z.object({
  reason: z.string().trim().min(1).max(300),
  idempotencyKey: z.string().min(8).max(100).optional(),
  acceptedChargePercent: z.number().int().min(0).max(100).optional(),
  items: z.array(cancellationItem.extend({ acceptedChargePercent: z.number().int().min(0).max(100) }).strict()).min(1).max(50).optional(),
}).strict().superRefine((body, context) => {
  if (!body.items && body.acceptedChargePercent === undefined) context.addIssue({ code: "custom", message: "Confirm the cancellation charge." });
});
export const policyBody = z.object({ holdMinutes: z.number().int().min(1).max(30), freeCancellationMinutes: z.number().int().min(0).max(60), partialCancellationMinutes: z.number().int().min(1).max(120), partialChargePercent: z.number().int().min(1).max(99), defaultPrepMinutes: z.number().int().min(1).max(240) }).refine(p => p.partialCancellationMinutes > p.freeCancellationMinutes, "Partial cancellation must end after the free cancellation window.");
export const preparationBody = z.object({ prepMinutes: z.number().int().min(1).max(240) });
export const etaBody = z.object({ minutes: z.number().int().min(1).max(240) });
