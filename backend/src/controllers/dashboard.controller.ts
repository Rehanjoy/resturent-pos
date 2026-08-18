import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as dashboardService from "../services/dashboard.service";

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await dashboardService.getDashboardSummary(req.user!.restaurantId);
  res.status(200).json({ summary });
});
