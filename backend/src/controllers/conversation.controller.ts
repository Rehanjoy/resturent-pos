import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as conversationService from "../services/conversation.service";
import type { ConversationStatus } from "../models/conversation.model";

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const { status, page, limit } = req.query as unknown as {
    status?: ConversationStatus;
    page: number;
    limit: number;
  };
  const result = await conversationService.listConversations(req.user!.restaurantId, {
    status,
    page,
    limit,
  });
  res.status(200).json(result);
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const result = await conversationService.getConversation(req.user!.restaurantId, String(req.params.id));
  res.status(200).json(result);
});

export const replyToConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await conversationService.replyToConversation(
    req.user!.restaurantId,
    req.user!.userId,
    String(req.params.id),
    req.body.text,
  );
  res.status(200).json({ conversation });
});

export const closeConversation = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await conversationService.closeConversation(
    req.user!.restaurantId,
    String(req.params.id),
  );
  res.status(200).json({ conversation });
});

export const handBackToBot = asyncHandler(async (req: Request, res: Response) => {
  const conversation = await conversationService.handBackToBot(
    req.user!.restaurantId,
    String(req.params.id),
  );
  res.status(200).json({ conversation });
});
