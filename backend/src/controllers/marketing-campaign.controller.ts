import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as campaignService from "../services/marketing-campaign.service";

export const listCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await campaignService.listCampaigns(req.user!.restaurantId, { page, limit });
  res.status(200).json(result);
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.createCampaign(
    req.user!.restaurantId,
    req.user!.userId,
    req.body,
  );
  res.status(201).json({ campaign });
});

export const getCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignService.getCampaign(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ campaign });
});

export const listCampaignRecipients = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await campaignService.listCampaignRecipients(
    req.user!.restaurantId,
    String(req.params.id),
    { page, limit },
  );
  res.status(200).json(result);
});
