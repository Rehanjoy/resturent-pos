import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as settingsService from "../services/settings.service";

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.getSettings(req.user!.restaurantId);
  res.status(200).json({ settings });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateProfile(
    req.user!.restaurantId,
    req.user!.userId,
    req.body,
  );
  res.status(200).json({ settings });
});

export const updateTaxConfig = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateTaxConfig(
    req.user!.restaurantId,
    req.user!.userId,
    req.body.taxConfig,
  );
  res.status(200).json({ settings });
});

export const updateDiscountThreshold = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updateDiscountThreshold(
    req.user!.restaurantId,
    req.user!.userId,
    req.body,
  );
  res.status(200).json({ settings });
});

export const getPaymentModes = asyncHandler(async (req: Request, res: Response) => {
  const enabledPaymentModes = await settingsService.getEnabledPaymentModes(req.user!.restaurantId);
  res.status(200).json({ enabledPaymentModes });
});

export const updatePaymentModes = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.updatePaymentModes(
    req.user!.restaurantId,
    req.user!.userId,
    req.body.enabledPaymentModes,
  );
  res.status(200).json({ settings });
});
