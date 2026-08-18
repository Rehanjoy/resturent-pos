import { z } from "zod";
import { USER_ROLES } from "../models/user.model";

const phoneSchema = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number.")
  .max(20, "Enter a valid phone number.");

export const createStaffSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: phoneSchema.optional(),
  role: z.enum(USER_ROLES),
  // Optional — left blank, the server auto-generates a temporary password
  // and returns it once in the response (see staff.service.ts). If
  // supplied, must meet the same minimum the self-service reset flow uses.
  password: z.string().min(8, "Password must be at least 8 characters.").optional(),
});

export const updateStaffSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: phoneSchema.optional(),
    role: z.enum(USER_ROLES).optional(),
  })
  .refine((body) => body.name !== undefined || body.phone !== undefined || body.role !== undefined, {
    message: "Provide at least one field to update.",
  });

export const staffIdParamsSchema = z.object({
  id: z.string().min(1, "Staff id is required."),
});

export const staffSessionParamsSchema = z.object({
  id: z.string().min(1, "Staff id is required."),
  sessionId: z.string().min(1, "Session id is required."),
});

export const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
