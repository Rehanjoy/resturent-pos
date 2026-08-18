import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as menuItemService from "../services/menu-item.service";

export const listMenuItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await menuItemService.listMenuItems(req.user!.restaurantId, {
    categoryId: req.query.categoryId as string | undefined,
  });
  res.status(200).json({ menuItems: items });
});

export const createMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await menuItemService.createMenuItem(req.user!.restaurantId, req.body);
  res.status(201).json({ menuItem: item });
});

export const updateMenuItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await menuItemService.updateMenuItem(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ menuItem: item });
});

export const deleteMenuItem = asyncHandler(async (req: Request, res: Response) => {
  await menuItemService.deleteMenuItem(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Dish deleted." });
});
