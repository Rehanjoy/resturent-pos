import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as aiConfigService from "../services/ai-config.service";

export const getAiConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await aiConfigService.getAiConfig(req.user!.restaurantId);
  res.status(200).json({ config });
});

export const saveAiConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await aiConfigService.saveAiConfig(req.user!.restaurantId, {
    geminiApiKey: req.body.geminiApiKey || undefined,
    systemPromptExtra: req.body.systemPromptExtra,
    autoReplyEnabled: req.body.autoReplyEnabled,
    maxAutoRepliesPerConversation: req.body.maxAutoRepliesPerConversation,
  });
  res.status(200).json({ config });
});
