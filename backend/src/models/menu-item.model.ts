import { Schema, model, type Types } from "mongoose";

export const MENU_ITEM_TYPES = ["veg", "non-veg", "egg"] as const;
export type MenuItemType = (typeof MENU_ITEM_TYPES)[number];

export const SPICE_LEVELS = ["none", "mild", "medium", "spicy"] as const;
export type SpiceLevel = (typeof SPICE_LEVELS)[number];

/** One ingredient-to-inventory link (PRD §3.8/§3.9 "ingredient-to-inventory
 * linking: each dish maps to inventory items + quantity consumed per unit
 * sold"). `quantityPerUnit` is in the mapped `InventoryItem`'s own `unit`
 * (e.g. 0.2 kg of paneer per Paneer Tikka sold). Read by
 * `inventory-deduction.service.ts` on send-to-kitchen. */
export interface IngredientMappingEntry {
  inventoryItemId: Types.ObjectId;
  quantityPerUnit: number;
  quantityPerRecipe?: number;
}

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
  prepMinutes?: number;
  ingredientMapping: IngredientMappingEntry[];
  recipeYield?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ingredientMappingSchema = new Schema<IngredientMappingEntry>(
  {
    inventoryItemId: { type: Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    quantityPerUnit: { type: Number, required: true, min: 0 },
    quantityPerRecipe: { type: Number, min: 0 },
  },
  { _id: false },
);

/**
 * A sellable dish. `isAvailable` is the "86'd items" toggle (PRD §3.8) —
 * Owner/Manager can flip it instantly without opening the full edit form.
 *
 * `ingredientMapping` links this dish to the Inventory module (PRD §3.9) —
 * populated from the "Ingredients used" section of the Add/Edit Dish
 * modal, and read by `inventory-deduction.service.ts` to auto-deduct stock
 * when an order containing this dish is sent to the kitchen.
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
    prepMinutes: { type: Number, min: 1, max: 240 },
    recipeYield: { type: Number, min: 1, default: 1 },
    ingredientMapping: { type: [ingredientMappingSchema], default: [] },
  },
  { timestamps: true },
);

menuItemSchema.index({ restaurantId: 1, categoryId: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });

export const MenuItem = model<MenuItemDocument>("MenuItem", menuItemSchema);
