import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Category } from "../models/category.model";
import { InventoryItem } from "../models/inventory-item.model";
import {
  MenuItem,
  type IngredientMappingEntry,
  type MenuItemDocument,
  type MenuItemType,
  type SpiceLevel,
} from "../models/menu-item.model";

export interface IngredientMappingDto {
  inventoryItemId: string;
  quantityPerUnit: number;
  quantityPerRecipe?: number;
}

export interface MenuItemDto {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
  isAvailable: boolean;
  prepMinutes?: number;
  ingredientMapping: IngredientMappingDto[];
  recipeYield: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(item: HydratedDocument<MenuItemDocument>): MenuItemDto {
  return {
    id: item._id.toString(),
    restaurantId: item.restaurantId.toString(),
    categoryId: item.categoryId.toString(),
    name: item.name,
    description: item.description,
    price: item.price,
    type: item.type,
    spiceLevel: item.spiceLevel,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    prepMinutes: item.prepMinutes,
    ingredientMapping: (item.ingredientMapping ?? []).map((entry) => ({
      inventoryItemId: entry.inventoryItemId.toString(),
      quantityPerUnit: entry.quantityPerUnit,
      quantityPerRecipe: entry.quantityPerRecipe,
    })),
    recipeYield: item.recipeYield ?? 1,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function assertCategoryExists(
  restaurantId: string,
  categoryId: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new AppError("Selected category does not exist.", 400, "CATEGORY_NOT_FOUND");
  }
  const category = await Category.findOne({ _id: categoryId, restaurantId });
  if (!category) {
    throw new AppError("Selected category does not exist.", 400, "CATEGORY_NOT_FOUND");
  }
}

/**
 * Validates every `inventoryItemId` in a dish's ingredient mapping belongs
 * to this restaurant before it's saved (PRD §3.8 ingredient-to-inventory
 * linking) — same "reject at the edge, never trust an id blindly" pattern
 * as `assertCategoryExists`.
 */
async function assertIngredientMappingValid(
  restaurantId: string,
  mapping: { inventoryItemId: string; quantityPerUnit: number }[],
): Promise<IngredientMappingEntry[]> {
  if (mapping.length === 0) return [];

  const ids = mapping.map((entry) => entry.inventoryItemId);
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw new AppError(
      "One of the selected ingredients does not exist.",
      400,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  const found = await InventoryItem.find({ _id: { $in: ids }, restaurantId }).select("_id");
  const foundIds = new Set(found.map((item) => item._id.toString()));
  if (foundIds.size !== new Set(ids).size) {
    throw new AppError(
      "One of the selected ingredients does not exist.",
      400,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  return mapping.map((entry) => ({
    inventoryItemId: new Types.ObjectId(entry.inventoryItemId),
    quantityPerUnit: entry.quantityPerUnit,
  }));
}

async function findMenuItemOrThrow(
  restaurantId: string,
  menuItemId: string,
): Promise<HydratedDocument<MenuItemDocument>> {
  if (!Types.ObjectId.isValid(menuItemId)) {
    throw new AppError("Dish not found.", 404, "NOT_FOUND");
  }
  const item = await MenuItem.findOne({ _id: menuItemId, restaurantId });
  if (!item) {
    throw new AppError("Dish not found.", 404, "NOT_FOUND");
  }
  return item;
}

export async function listMenuItems(
  restaurantId: string,
  filters: { categoryId?: string },
): Promise<MenuItemDto[]> {
  const items = await MenuItem.find({
    restaurantId,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  }).sort({ name: 1 });
  return items.map(toDto);
}

export interface MenuItemInput {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  type: MenuItemType;
  spiceLevel?: SpiceLevel;
  imageUrl?: string;
  isAvailable?: boolean;
  ingredientMapping?: IngredientMappingDto[];
}

export async function createMenuItem(
  restaurantId: string,
  input: MenuItemInput,
): Promise<MenuItemDto> {
  await assertCategoryExists(restaurantId, input.categoryId);
  const ingredientMapping = await assertIngredientMappingValid(
    restaurantId,
    input.ingredientMapping ?? [],
  );

  const item = await MenuItem.create({
    restaurantId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    price: input.price,
    type: input.type,
    spiceLevel: input.spiceLevel,
    imageUrl: input.imageUrl || undefined,
    isAvailable: input.isAvailable ?? true,
    ingredientMapping,
  });
  return toDto(item);
}

export async function updateMenuItem(
  restaurantId: string,
  menuItemId: string,
  input: Partial<MenuItemInput>,
): Promise<MenuItemDto> {
  const item = await findMenuItemOrThrow(restaurantId, menuItemId);

  if (input.categoryId) {
    await assertCategoryExists(restaurantId, input.categoryId);
    item.categoryId = new Types.ObjectId(input.categoryId);
  }
  if (input.name !== undefined) item.name = input.name;
  if (input.description !== undefined) item.description = input.description;
  if (input.price !== undefined) item.price = input.price;
  if (input.type !== undefined) item.type = input.type;
  if (input.spiceLevel !== undefined) item.spiceLevel = input.spiceLevel;
  if (input.imageUrl !== undefined) item.imageUrl = input.imageUrl || undefined;
  if (input.isAvailable !== undefined) item.isAvailable = input.isAvailable;
  if (input.ingredientMapping !== undefined) {
    item.ingredientMapping = await assertIngredientMappingValid(
      restaurantId,
      input.ingredientMapping,
    );
  }

  await item.save();
  return toDto(item);
}

export async function deleteMenuItem(
  restaurantId: string,
  menuItemId: string,
): Promise<void> {
  const item = await findMenuItemOrThrow(restaurantId, menuItemId);
  await item.deleteOne();
}
