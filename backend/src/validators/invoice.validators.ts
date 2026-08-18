import { z } from "zod";
import { DISCOUNT_TYPES } from "../models/invoice.model";

export const discountInputSchema = z
  .object({
    type: z.enum(DISCOUNT_TYPES),
    value: z.number().nonnegative("Discount value cannot be negative."),
  })
  .refine((discount) => discount.type !== "percent" || discount.value <= 100, {
    message: "A percent discount cannot exceed 100.",
    path: ["value"],
  });

export const generateInvoiceSchema = z
  .object({
    discount: discountInputSchema.optional(),
    approverEmail: z.string().trim().toLowerCase().email("Enter a valid email.").optional(),
    approverPassword: z.string().min(1, "Approver password is required.").optional(),
  })
  .refine((body) => !body.approverEmail || !!body.approverPassword, {
    message: "Approver password is required when an approver email is provided.",
    path: ["approverPassword"],
  });

export const orderIdParamsSchema = z.object({
  orderId: z.string().min(1, "Order id is required."),
});

export const invoiceIdParamsSchema = z.object({
  id: z.string().min(1, "Invoice id is required."),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to void an invoice.").max(300),
});
