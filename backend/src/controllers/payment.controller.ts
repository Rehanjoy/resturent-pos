import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as paymentService from "../services/payment.service";

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const result = await paymentService.createPayment(req.user!.restaurantId, req.body);
  res.status(201).json(result);
});
