import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as categoryService from "../services/category.service";

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await categoryService.listCategories(req.user!.restaurantId);
  res.status(200).json({ categories });
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(
    req.user!.restaurantId,
    req.body,
  );
  res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.updateCategory(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ category });
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Category deleted." });
});
