/** Mirrors `backend/src/services/category.service.ts` `CategoryDto`. */
export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type MenuItemType = "veg" | "non-veg" | "egg";
export type SpiceLevel = "none" | "mild" | "medium" | "spicy";

/** One ingredient-to-inventory link — see
 * `backend/src/models/menu-item.model.ts` `IngredientMappingEntry`.
 * `quantityPerUnit` is in the mapped inventory item's own unit. */
export interface IngredientMapping {
  inventoryItemId: string;
  quantityPerUnit: number;
}

/** Mirrors `backend/src/services/menu-item.service.ts` `MenuItemDto`. */
export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  /** Integer paise — see `lib/format.ts`. */
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
  isAvailable: boolean;
  ingredientMapping: IngredientMapping[];
  createdAt: string;
  updatedAt: string;
}
