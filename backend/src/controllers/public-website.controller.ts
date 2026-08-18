import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as publicWebsiteService from "../services/public-website.service";

export const getPublicWebsite = asyncHandler(async (req: Request, res: Response) => {
  const website = await publicWebsiteService.getPublicWebsite(String(req.params.restaurantSlug));
  res.status(200).json({ website });
});
