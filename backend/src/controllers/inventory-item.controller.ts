import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { emitToRestaurant } from "../sockets";
import * as inventoryItemService from "../services/inventory-item.service";

export const listInventoryItems = asyncHandler(async (req: Request, res: Response) => {
  const items = await inventoryItemService.listInventoryItems(req.user!.restaurantId, {
    categoryId: req.query.categoryId as string | undefined,
    search: req.query.search as string | undefined,
  });
  res.status(200).json({ inventoryItems: items });
});

export const createInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryItemService.createInventoryItem(req.user!.restaurantId, req.body);
  emitToRestaurant(req.user!.restaurantId, "inventory:changed", {});
  res.status(201).json({ inventoryItem: item });
});

export const updateInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryItemService.updateInventoryItem(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body,
  );
  emitToRestaurant(req.user!.restaurantId, "inventory:changed", {});
  res.status(200).json({ inventoryItem: item });
});

export const deleteInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  await inventoryItemService.deleteInventoryItem(req.user!.restaurantId, String(req.params.id));
  emitToRestaurant(req.user!.restaurantId, "inventory:changed", {});
  res.status(200).json({ message: "Inventory item deleted." });
});

export const adjustInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryItemService.adjustInventoryItem(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body,
  );
  emitToRestaurant(req.user!.restaurantId, "inventory:changed", {});
  res.status(200).json({ inventoryItem: item });
});

export const toggleReorderRequested = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryItemService.toggleReorderRequested(
    req.user!.restaurantId,
    String(req.params.id),
  );
  emitToRestaurant(req.user!.restaurantId, "inventory:changed", {});
  res.status(200).json({ inventoryItem: item });
});
