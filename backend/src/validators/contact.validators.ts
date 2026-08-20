import { z } from "zod";
import { E164_PHONE_REGEX } from "../utils/phone";

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(E164_PHONE_REGEX, "Enter a valid phone number in E.164 format (e.g. +919876543210).");

const tagSchema = z.string().trim().min(1).max(40);

export const createContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  phone: e164PhoneSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email.").optional().or(z.literal("")),
  tags: z.array(tagSchema).max(20, "A contact can have at most 20 tags.").optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const updateContactSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: e164PhoneSchema.optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email.").optional().or(z.literal("")),
    tags: z.array(tagSchema).max(20, "A contact can have at most 20 tags.").optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    optedIn: z.boolean().optional(),
  })
  .strict();

export const contactIdParamsSchema = z.object({
  id: z.string().min(1, "Contact id is required."),
});

export const listContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  // Name-or-phone-contains, case-insensitive.
  search: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(40).optional(),
});
