import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as tableService from "../services/table.service";

export const listTables = asyncHandler(async (req: Request, res: Response) => {
  const tables = await tableService.listTables(req.user!.restaurantId, {
    areaId: req.query.areaId as string | undefined,
  });
  res.status(200).json({ tables });
});

export const createTable = asyncHandler(async (req: Request, res: Response) => {
  const table = await tableService.createTable(req.user!.restaurantId, req.body);
  res.status(201).json({ table });
});

export const updateTable = asyncHandler(async (req: Request, res: Response) => {
  const table = await tableService.updateTable(
    req.user!.restaurantId,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ table });
});

export const deleteTable = asyncHandler(async (req: Request, res: Response) => {
  await tableService.deleteTable(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ message: "Table deleted." });
});

export const updateTableStatus = asyncHandler(async (req: Request, res: Response) => {
  const table = await tableService.updateTableStatus(
    req.user!.restaurantId,
    String(req.params.id),
    req.body.status,
  );
  res.status(200).json({ table });
});
