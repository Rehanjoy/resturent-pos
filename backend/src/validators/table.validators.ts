import { z } from "zod";
import { TABLE_SHAPES, TABLE_STATUSES } from "../models/table.model";

export const createTableSchema = z.object({
  areaId: z.string().min(1, "Area is required."),
  name: z.string().trim().min(1, "Table name is required.").max(40),
  seatingCapacity: z
    .number()
    .int("Seating capacity must be a whole number.")
    .min(1, "Seating capacity must be at least 1."),
  shape: z.enum(TABLE_SHAPES),
});

// Structural edit (name/area/capacity/shape) — Owner/Manager only. Status
// is deliberately excluded here; it only changes through the dedicated
// `updateTableStatusSchema` endpoint, which Server can also hit.
export const updateTableSchema = z.object({
  areaId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(40).optional(),
  seatingCapacity: z.number().int().min(1).optional(),
  shape: z.enum(TABLE_SHAPES).optional(),
});

export const updateTableStatusSchema = z.object({
  status: z.enum(TABLE_STATUSES),
});

export const tableIdParamsSchema = z.object({
  id: z.string().min(1, "Table id is required."),
});

export const tableListQuerySchema = z.object({
  areaId: z.string().min(1).optional(),
});
