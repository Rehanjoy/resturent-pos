import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as orderService from "../services/order.service";
import type { OrderStatus } from "../models/order.model";

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await orderService.listOrders(req.user!.restaurantId, {
    status: req.query.status as OrderStatus | undefined,
    tableId: req.query.tableId as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  res.status(200).json({ orders });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrder(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ order });
});

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.createOrder(
    req.user!.restaurantId,
    req.user!.userId,
    req.body.tableId,
  );
  res.status(result.created ? 201 : 200).json({ order: result.order });
});

export const editOrderItems = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.editOrderItems(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ order });
});

export const sendToKitchen = asyncHandler(async (req: Request, res: Response) => {
  const result = await orderService.sendToKitchen(req.user!.restaurantId, String(req.params.id));
  res.status(200).json(result);
});

export const serveOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.serveOrder(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body?.itemIds,
  );
  res.status(200).json({ order });
});

export const voidOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.voidOrder(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body.reason,
  );
  res.status(200).json({ order });
});
