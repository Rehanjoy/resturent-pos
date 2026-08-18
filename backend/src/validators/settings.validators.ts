import { z } from "zod";
import { DISCOUNT_TYPES } from "../models/invoice.model";
import { PAYMENT_MODES } from "../models/payment.model";

export const addressSchema = z.object({
  line1: z.string().trim().max(120).optional(),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Restaurant name is required.").max(120).optional(),
  address: addressSchema.optional(),
  gstNumber: z.string().trim().max(20).optional(),
  logoUrl: z.string().trim().url("Enter a valid URL.").max(500).optional().or(z.literal("")),
});

const taxConfigEntrySchema = z.object({
  name: z.string().trim().min(1, "Tax name is required.").max(40),
  ratePercent: z
    .number()
    .min(0, "Tax rate cannot be negative.")
    .max(100, "Tax rate cannot exceed 100%."),
  type: z.enum(["CGST", "SGST", "VAT", "other"]),
});

export const updateTaxConfigSchema = z
  .object({
    taxConfig: z.array(taxConfigEntrySchema).max(20),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<string>();
    body.taxConfig.forEach((entry, index) => {
      const key = entry.name.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate tax name "${entry.name}" — tax slab names must be unique.`,
          path: ["taxConfig", index, "name"],
        });
      }
      seen.add(key);
    });
  });

export const updateDiscountThresholdSchema = z
  .object({
    type: z.enum(DISCOUNT_TYPES),
    value: z.number().nonnegative("Threshold value cannot be negative."),
  })
  .refine((body) => body.type !== "percent" || body.value <= 100, {
    message: "A percent threshold cannot exceed 100.",
    path: ["value"],
  });

export const updatePaymentModesSchema = z
  .object({
    enabledPaymentModes: z
      .array(z.enum(PAYMENT_MODES))
      .min(1, "At least one payment mode must stay enabled."),
  })
  .refine(
    (body) => new Set(body.enabledPaymentModes).size === body.enabledPaymentModes.length,
    { message: "Payment modes cannot be listed more than once.", path: ["enabledPaymentModes"] },
  );
