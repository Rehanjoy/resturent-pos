import { Schema, model, type Types } from "mongoose";

export const MENU_ITEM_TYPES = ["veg", "non-veg", "egg"] as const;
export type MenuItemType = (typeof MENU_ITEM_TYPES)[number];

export const SPICE_LEVELS = ["none", "mild", "medium", "spicy"] as const;
export type SpiceLevel = (typeof SPICE_LEVELS)[number];

export interface MenuItemDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description?: string;
  /** Smallest currency unit (paise) as an integer — never a float. */
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
  isAvailable: boolean;
  ingredientMapping: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A sellable dish. `isAvailable` is the "86'd items" toggle (PRD §3.8) —
 * Owner/Manager can flip it instantly without opening the full edit form.
 *
 * `ingredientMapping` is an intentionally empty placeholder array. It
 * activates in the Phase 2 Inventory module (PRD §3.9 "ingredient-to-
 * inventory linking") — no deduction/costing logic reads or writes it yet.
 */
const menuItemSchema = new Schema<MenuItemDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    type: { type: String, enum: MENU_ITEM_TYPES, required: true },
    spiceLevel: { type: String, enum: SPICE_LEVELS },
    imageUrl: { type: String, trim: true },
    isAvailable: { type: Boolean, required: true, default: true },
    // Phase 2 Inventory placeholder — see doc comment above.
    ingredientMapping: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

menuItemSchema.index({ restaurantId: 1, categoryId: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });

export const MenuItem = model<MenuItemDocument>("MenuItem", menuItemSchema);
