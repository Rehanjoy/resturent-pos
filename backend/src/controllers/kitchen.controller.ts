import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as kitchenService from "../services/kitchen.service";

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const tickets = await kitchenService.listActiveTickets(req.user!.restaurantId);
  res.status(200).json({ tickets });
});

export const markItemReady = asyncHandler(async (req: Request, res: Response) => {
  const kot = await kitchenService.markItemReady(
    req.user!.restaurantId,
    String(req.params.kotId),
    req.body.orderItemId,
  );
  res.status(200).json({ kot });
});

export const markAllReady = asyncHandler(async (req: Request, res: Response) => {
  const kot = await kitchenService.markAllReady(req.user!.restaurantId, String(req.params.kotId));
  res.status(200).json({ kot });
});
