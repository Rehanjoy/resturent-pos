import { z } from "zod";
import { INVENTORY_TRANSACTION_TYPES } from "../models/inventory-transaction.model";

export const inventoryTransactionListQuerySchema = z.object({
  itemId: z.string().min(1).optional(),
  type: z.enum(INVENTORY_TRANSACTION_TYPES).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});
