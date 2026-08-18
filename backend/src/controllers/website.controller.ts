import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as websiteService from "../services/website.service";

export const getWebsiteContent = asyncHandler(async (req: Request, res: Response) => {
  const content = await websiteService.getWebsiteContent(req.user!.restaurantId);
  res.status(200).json({ content });
});

export const updateWebsiteContent = asyncHandler(async (req: Request, res: Response) => {
  const content = await websiteService.updateWebsiteContent(req.user!.restaurantId, req.body);
  res.status(200).json({ content });
});

export const addGalleryImage = asyncHandler(async (req: Request, res: Response) => {
  const content = await websiteService.addGalleryImage(
    req.user!.restaurantId,
    req.body.imageUrl as string,
  );
  res.status(201).json({ content });
});
