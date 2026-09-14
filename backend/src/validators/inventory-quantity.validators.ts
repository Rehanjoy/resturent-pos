import { z } from "zod";
import { quantityToMicros } from "../services/inventory-quantity.service";
export const inventoryQuantitySchema = z.number().finite().min(0).max(1_000_000).refine((value) => {
  try { quantityToMicros(value); return true; } catch { return false; }
}, "Use at most 6 decimal places for quantities.");
