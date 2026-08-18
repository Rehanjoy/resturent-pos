import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as inventoryCategoryService from "../services/inventory-category.service";

export const listInventoryCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await inventoryCategoryService.listInventoryCategories(
    req.user!.restaurantId,
  );
  res.status(200).json({ categories });
});

export const createInventoryCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await inventoryCategoryService.createInventoryCategory(
    req.user!.restaurantId,
    req.body,
  );
  res.status(201).json({ category });
});

export const updateInventoryCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await inventoryCategoryService.updateInventoryCategory(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ category });
});

export const deleteInventoryCategory = asyncHandler(async (req: Request, res: Response) => {
  await inventoryCategoryService.deleteInventoryCategory(
    req.user!.restaurantId,
    String(req.params.id),
  );
  res.status(200).json({ message: "Inventory category deleted." });
});
