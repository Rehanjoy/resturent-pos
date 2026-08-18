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
  createdAt: string;
  updatedAt: string;
}
