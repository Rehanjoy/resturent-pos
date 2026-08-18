import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as areaService from "../services/area.service";

export const listAreas = asyncHandler(async (req: Request, res: Response) => {
  const areas = await areaService.listAreas(req.user!.restaurantId);
  res.status(200).json({ areas });
});

export const createArea = asyncHandler(async (req: Request, res: Response) => {
  const area = await areaService.createArea(req.user!.restaurantId, req.body);
  res.status(201).json({ area });
});

export const updateArea = asyncHandler(async (req: Request, res: Response) => {
  const area = await areaService.updateArea(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ area });
});

export const deleteArea = asyncHandler(async (req: Request, res: Response) => {
  await areaService.deleteArea(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Area deleted." });
});
