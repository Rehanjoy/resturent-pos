import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";
import * as mediaService from "../services/media.service";

export const uploadMenuImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError("Choose an image to upload.", 400, "IMAGE_REQUIRED");
  const image = await mediaService.storeMenuImage(req.user!.restaurantId, req.file);
  const forwardedProtocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const origin = `${forwardedProtocol || req.protocol}://${req.get("host")}`;
  res.status(201).json({ imageUrl: `${origin}/api/public/media/${image.id}`, image });
});

export const serveMenuImage = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const image = await mediaService.findMenuImage(id);
  const etag = `"${id}"`;
  if (req.get("if-none-match") === etag) {
    res.status(304).end();
    return;
  }
  res.set({
    "Content-Type": typeof image.metadata?.contentType === "string" ? image.metadata.contentType : "application/octet-stream",
    "Content-Length": String(image.length),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Cross-Origin-Resource-Policy": "cross-origin",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  });
  mediaService.openMenuImage(id).once("error", () => {
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  }).pipe(res);
});
