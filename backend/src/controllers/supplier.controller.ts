import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as supplierService from "../services/supplier.service";

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const suppliers = await supplierService.listSuppliers(req.user!.restaurantId);
  res.status(200).json({ suppliers });
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.createSupplier(req.user!.restaurantId, req.body);
  res.status(201).json({ supplier });
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await supplierService.updateSupplier(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ supplier });
});
