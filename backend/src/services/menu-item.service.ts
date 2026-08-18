import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Category } from "../models/category.model";
import {
  MenuItem,
  type MenuItemDocument,
  type MenuItemType,
  type SpiceLevel,
} from "../models/menu-item.model";

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
}

export async function createMenuItem(
  restaurantId: string,
  input: MenuItemInput,
): Promise<MenuItemDto> {
  await assertCategoryExists(restaurantId, input.categoryId);

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
    ingredientMapping: [],
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
