import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import {
  InventoryCategory,
  type InventoryCategoryDocument,
} from "../models/inventory-category.model";
import { InventoryItem } from "../models/inventory-item.model";

export interface InventoryCategoryDto {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(category: HydratedDocument<InventoryCategoryDocument>): InventoryCategoryDto {
  return {
    id: category._id.toString(),
    restaurantId: category.restaurantId.toString(),
    name: category.name,
    displayOrder: category.displayOrder,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

async function assertUniqueName(
  restaurantId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const existing = await InventoryCategory.findOne({
    restaurantId,
    name,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new AppError(
      `An inventory category named "${name}" already exists.`,
      409,
      "DUPLICATE_CATEGORY_NAME",
    );
  }
}

export async function listInventoryCategories(
  restaurantId: string,
): Promise<InventoryCategoryDto[]> {
  const categories = await InventoryCategory.find({ restaurantId }).sort({
    displayOrder: 1,
    name: 1,
  });
  return categories.map(toDto);
}

export async function createInventoryCategory(
  restaurantId: string,
  input: { name: string; displayOrder?: number },
): Promise<InventoryCategoryDto> {
  await assertUniqueName(restaurantId, input.name);
  const category = await InventoryCategory.create({
    restaurantId,
    name: input.name,
    displayOrder: input.displayOrder ?? 0,
  });
  return toDto(category);
}

async function findInventoryCategoryOrThrow(
  restaurantId: string,
  categoryId: string,
): Promise<HydratedDocument<InventoryCategoryDocument>> {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new AppError("Inventory category not found.", 404, "NOT_FOUND");
  }
  const category = await InventoryCategory.findOne({ _id: categoryId, restaurantId });
  if (!category) {
    throw new AppError("Inventory category not found.", 404, "NOT_FOUND");
  }
  return category;
}

export async function updateInventoryCategory(
  restaurantId: string,
  categoryId: string,
  input: { name?: string; displayOrder?: number },
): Promise<InventoryCategoryDto> {
  const category = await findInventoryCategoryOrThrow(restaurantId, categoryId);

  if (input.name && input.name !== category.name) {
    await assertUniqueName(restaurantId, input.name, categoryId);
    category.name = input.name;
  }
  if (input.displayOrder !== undefined) {
    category.displayOrder = input.displayOrder;
  }

  await category.save();
  return toDto(category);
}

export async function deleteInventoryCategory(
  restaurantId: string,
  categoryId: string,
): Promise<void> {
  const category = await findInventoryCategoryOrThrow(restaurantId, categoryId);

  const itemCount = await InventoryItem.countDocuments({
    restaurantId,
    categoryId: category._id,
  });
  if (itemCount > 0) {
    throw new AppError(
      "This category still has inventory items in it. Move or delete those items first.",
      409,
      "CATEGORY_HAS_ITEMS",
    );
  }

  await category.deleteOne();
}
