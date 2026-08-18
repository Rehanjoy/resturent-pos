import { Schema, model, type Types } from "mongoose";

export interface InventoryCategoryDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inventory item category (Beverages/Dairy/Grains/Meat/Pantry/etc. — PRD
 * §3.9). Deliberately its own collection, not a re-use of the Menu
 * `Category` model — a dish category ("Starters") and a stock category
 * ("Dairy") are different taxonomies that happen to share a CRUD shape.
 * Same unique-name-per-restaurant rule as `category.model.ts` so the
 * Inventory screen's category filter/management modal never shows
 * duplicate labels.
 */
const inventoryCategorySchema = new Schema<InventoryCategoryDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    displayOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

inventoryCategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
inventoryCategorySchema.index({ restaurantId: 1, displayOrder: 1 });

export const InventoryCategory = model<InventoryCategoryDocument>(
  "InventoryCategory",
  inventoryCategorySchema,
);
