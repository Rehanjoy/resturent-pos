import { Schema, model, type Types } from "mongoose";

export interface SupplierDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Supplier management (PRD §3.9 "name, contact, linked items, purchase
 * history"). "Linked items" is the `InventoryItem.supplierId` back-
 * reference, and "purchase history" is the existing append-only
 * `InventoryTransaction` log filtered to `type: "restock"` — deliberately
 * no second ledger lives on this model.
 */
const supplierSchema = new Schema<SupplierDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

supplierSchema.index({ restaurantId: 1, name: 1 });

export const Supplier = model<SupplierDocument>("Supplier", supplierSchema);
