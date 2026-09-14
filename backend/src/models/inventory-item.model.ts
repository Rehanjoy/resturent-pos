import { Schema, model, type Types } from "mongoose";

export interface InventoryItemDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  /** Free-text unit label, e.g. "kg", "L", "pcs" — deliberately not an enum,
   * different restaurants/suppliers use different conventions. */
  unit: string;
  /** Smallest currency unit (paise) as an integer — never a float, per
   * coding-standards.md. */
  costPerUnit: number;
  priceHistory: { oldCostPerUnit: number; costPerUnit: number; changedAt: Date }[];
  /** Can be fractional (e.g. 4.5kg of rice left) — unlike order/menu
   * quantities, this is intentionally NOT constrained to integers. Also
   * intentionally has no `min: 0` — see `inventory-deduction.service.ts`
   * for why stock is allowed to go negative rather than blocking an order. */
  currentStock: number;
  reorderThreshold: number;
  expectedDailyUsage: number;
  /** Durable replay protection for QR deductions; do not prune while replay is possible. */
  processedDeductionKeys: string[];
  supplierId?: Types.ObjectId;
  /** The "Reorder" / "Reordered" status badge on the Inventory screen.
   * Set manually via `PATCH /:id/reorder-requested` ("I've placed the
   * order with the supplier") and cleared automatically the moment a
   * restock brings `currentStock` back above `reorderThreshold` — see
   * `inventory-item.service.ts` `maybeClearReorderRequested`. */
  reorderRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    costPerUnit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    priceHistory: {
      type: [{ oldCostPerUnit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }, costPerUnit: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }, changedAt: { type: Date, required: true } }],
      default: [],
    },
    currentStock: { type: Number, required: true, default: 0 },
    reorderThreshold: { type: Number, required: true, min: 0, default: 0 },
    processedDeductionKeys: { type: [String], default: [] },
    expectedDailyUsage: { type: Number, required: true, min: 0, default: 0 },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    reorderRequested: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

inventoryItemSchema.index({ restaurantId: 1, categoryId: 1 });
inventoryItemSchema.index({ restaurantId: 1, name: 1 });
inventoryItemSchema.index({ restaurantId: 1, supplierId: 1 });

export const InventoryItem = model<InventoryItemDocument>("InventoryItem", inventoryItemSchema);
