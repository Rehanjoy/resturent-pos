import { Schema, model, type Types } from "mongoose";

export const INVENTORY_TRANSACTION_TYPES = ["deduction", "restock", "adjustment"] as const;
export type InventoryTransactionType = (typeof INVENTORY_TRANSACTION_TYPES)[number];

export interface InventoryTransactionDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  itemId: Types.ObjectId;
  type: InventoryTransactionType;
  /** Negative for a deduction, positive for a restock; either sign for a
   * manual adjustment/wastage correction. */
  quantityDelta: number;
  /** Required for `type: "adjustment"` (PRD §3.9 "fully audited") —
   * enforced at the validation edge (`adjustInventoryItemSchema`) and again
   * defensively in `inventory-item.service.ts` so the rule holds even for
   * direct service-level callers. */
  reason?: string;
  staffId: Types.ObjectId;
  /** Set when `type: "deduction"` and it was triggered by an order being
   * sent to the kitchen (PRD §3.9 auto-deduction). */
  relatedOrderId?: Types.ObjectId;
  createdAt: Date;
}

/**
 * Append-only stock ledger (PRD §3.9 "Stock adjustment log ... fully
 * audited"; PRD §7 "Immutable audit logging"). Same pattern as
 * `audit-log.model.ts` — deliberately no update/delete anywhere in this
 * codebase, only `InventoryTransaction.create(...)` and read queries. This
 * is also the "purchase history" the Supplier module reads (filtered to
 * `type: "restock"`) and the audit trail the Inventory screen's
 * transactions view reads — no second ledger exists anywhere else.
 */
const inventoryTransactionSchema = new Schema<InventoryTransactionDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    itemId: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    type: { type: String, enum: INVENTORY_TRANSACTION_TYPES, required: true },
    quantityDelta: { type: Number, required: true },
    reason: { type: String, trim: true },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    relatedOrderId: { type: Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventoryTransactionSchema.index({ restaurantId: 1, itemId: 1, createdAt: -1 });
inventoryTransactionSchema.index({ restaurantId: 1, type: 1, createdAt: -1 });

export const InventoryTransaction = model<InventoryTransactionDocument>(
  "InventoryTransaction",
  inventoryTransactionSchema,
);
