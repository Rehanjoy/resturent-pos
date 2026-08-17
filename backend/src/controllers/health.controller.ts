import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
