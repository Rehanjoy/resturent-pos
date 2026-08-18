import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required.").max(120),
  contactPhone: z.string().trim().max(30).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierIdParamsSchema = z.object({
  id: z.string().min(1, "Supplier id is required."),
});
