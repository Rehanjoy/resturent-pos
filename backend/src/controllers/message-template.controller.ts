import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as messageTemplateService from "../services/message-template.service";

export const listMessageTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await messageTemplateService.listMessageTemplates(req.user!.restaurantId);
  res.status(200).json({ templates });
});

export const syncMessageTemplates = asyncHandler(async (req: Request, res: Response) => {
  const result = await messageTemplateService.syncMessageTemplates(req.user!.restaurantId);
  res.status(200).json(result);
});
