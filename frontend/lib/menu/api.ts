import { api } from "@/lib/api";
import type { Category, IngredientMapping, MenuItem, MenuItemType, SpiceLevel } from "./types";

export const categoriesApi = {
  list: () => api.get<{ categories: Category[] }>("/api/categories"),

  create: (input: { name: string; displayOrder?: number }) =>
    api.post<{ category: Category }>("/api/categories", input),

  update: (id: string, input: { name?: string; displayOrder?: number }) =>
    api.patch<{ category: Category }>(`/api/categories/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/categories/${id}`),
};

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  /** Integer paise. */
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
  isAvailable?: boolean;
  ingredientMapping?: IngredientMapping[];
}

export const menuItemsApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.postForm<{ imageUrl: string; image: { id: string; contentType: string; length: number; filename: string } }>("/api/media/menu-image", formData);
  },

  list: (categoryId?: string) =>
    api.get<{ menuItems: MenuItem[] }>(
      `/api/menu-items${categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""}`,
    ),

  create: (input: MenuItemInput) =>
    api.post<{ menuItem: MenuItem }>("/api/menu-items", input),

  update: (id: string, input: Partial<MenuItemInput>) =>
    api.patch<{ menuItem: MenuItem }>(`/api/menu-items/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/menu-items/${id}`),
};
