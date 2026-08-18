import { z } from "zod";
import { MENU_ITEM_TYPES, SPICE_LEVELS } from "../models/menu-item.model";

// Price arrives from the client already converted to paise (integer,
// smallest currency unit) — see coding-standards.md "money as integers,
// never floats". The admin form converts rupees -> paise before calling
// the API.
const priceSchema = z
  .number()
  .int("Price must be a whole number of paise (no decimals).")
  .positive("Price must be greater than zero.");

export const createMenuItemSchema = z.object({
  categoryId: z.string().min(1, "Category is required."),
  name: z.string().trim().min(1, "Dish name is required.").max(120),
  description: z.string().trim().max(500).optional(),
  price: priceSchema,
  type: z.enum(MENU_ITEM_TYPES),
  spiceLevel: z.enum(SPICE_LEVELS).optional(),
  imageUrl: z
    .string()
    .trim()
    .url("Enter a valid image URL.")
    .optional()
    .or(z.literal("")),
  isAvailable: z.boolean().optional(),
});

export const updateMenuItemSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  price: priceSchema.optional(),
  type: z.enum(MENU_ITEM_TYPES).optional(),
  spiceLevel: z.enum(SPICE_LEVELS).optional(),
  imageUrl: z
    .string()
    .trim()
    .url("Enter a valid image URL.")
    .optional()
    .or(z.literal("")),
  isAvailable: z.boolean().optional(),
});

export const menuItemIdParamsSchema = z.object({
  id: z.string().min(1, "Menu item id is required."),
});

export const menuItemListQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
});
