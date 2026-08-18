import { z } from "zod";
import { ORDER_STATUSES } from "../models/order.model";
import { SPICE_LEVELS } from "../models/menu-item.model";

export const createOrderSchema = z.object({
  tableId: z.string().min(1, "Table is required."),
});

const addOnsSchema = z.array(z.string().trim().min(1).max(60)).max(20).optional();

export const addOrderItemSchema = z.object({
  menuItemId: z.string().min(1, "Dish is required."),
  qty: z
    .number()
    .int("Quantity must be a whole number.")
    .positive("Quantity must be at least 1."),
  spiceLevel: z.enum(SPICE_LEVELS).optional(),
  addOns: addOnsSchema,
  notes: z.string().trim().max(300).optional(),
});

export const updateOrderItemSchema = z.object({
  itemId: z.string().min(1, "Item id is required."),
  qty: z.number().int().positive().optional(),
  spiceLevel: z.enum(SPICE_LEVELS).optional(),
  addOns: addOnsSchema,
  notes: z.string().trim().max(300).optional(),
});

export const editOrderItemsSchema = z
  .object({
    addItems: z.array(addOrderItemSchema).optional(),
    updateItems: z.array(updateOrderItemSchema).optional(),
    removeItemIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (body) =>
      (body.addItems && body.addItems.length > 0) ||
      (body.updateItems && body.updateItems.length > 0) ||
      (body.removeItemIds && body.removeItemIds.length > 0),
    { message: "Provide at least one item to add, update, or remove." },
  );

export const serveOrderSchema = z.object({
  itemIds: z.array(z.string().min(1)).optional(),
});

export const voidOrderSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to void an order.").max(300),
});

export const orderIdParamsSchema = z.object({
  id: z.string().min(1, "Order id is required."),
});

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  tableId: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});
