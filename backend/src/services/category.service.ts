import { Types, type HydratedDocument } from "mongoose";
import { AppError } from "../utils/app-error";
import { Category, type CategoryDocument } from "../models/category.model";
import { MenuItem } from "../models/menu-item.model";

export interface CategoryDto {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(category: HydratedDocument<CategoryDocument>): CategoryDto {
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
  const existing = await Category.findOne({
    restaurantId,
    name,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new AppError(
      `A category named "${name}" already exists.`,
      409,
      "DUPLICATE_CATEGORY_NAME",
    );
  }
}

export async function listCategories(restaurantId: string): Promise<CategoryDto[]> {
  const categories = await Category.find({ restaurantId }).sort({
    displayOrder: 1,
    name: 1,
  });
  return categories.map(toDto);
}

export async function createCategory(
  restaurantId: string,
  input: { name: string; displayOrder?: number },
): Promise<CategoryDto> {
  await assertUniqueName(restaurantId, input.name);
  const category = await Category.create({
    restaurantId,
    name: input.name,
    displayOrder: input.displayOrder ?? 0,
  });
  return toDto(category);
}

async function findCategoryOrThrow(
  restaurantId: string,
  categoryId: string,
): Promise<HydratedDocument<CategoryDocument>> {
  if (!Types.ObjectId.isValid(categoryId)) {
    throw new AppError("Category not found.", 404, "NOT_FOUND");
  }
  const category = await Category.findOne({ _id: categoryId, restaurantId });
  if (!category) {
    throw new AppError("Category not found.", 404, "NOT_FOUND");
  }
  return category;
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  input: { name?: string; displayOrder?: number },
): Promise<CategoryDto> {
  const category = await findCategoryOrThrow(restaurantId, categoryId);

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

export async function deleteCategory(
  restaurantId: string,
  categoryId: string,
): Promise<void> {
  const category = await findCategoryOrThrow(restaurantId, categoryId);

  const itemCount = await MenuItem.countDocuments({
    restaurantId,
    categoryId: category._id,
  });
  if (itemCount > 0) {
    throw new AppError(
      "This category still has dishes in it. Move or delete those dishes first.",
      409,
      "CATEGORY_HAS_ITEMS",
    );
  }

  await category.deleteOne();
}
