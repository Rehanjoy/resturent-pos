import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as whatsappConfigService from "../services/whatsapp-config.service";

export const getWhatsappConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await whatsappConfigService.getWhatsappConfig(req.user!.restaurantId);
  res.status(200).json({ config });
});

export const saveWhatsappConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await whatsappConfigService.saveWhatsappConfig(req.user!.restaurantId, {
    phoneNumberId: req.body.phoneNumberId,
    accessToken: req.body.accessToken,
    wabaId: req.body.wabaId || undefined,
  });
  res.status(200).json({ config });
});
