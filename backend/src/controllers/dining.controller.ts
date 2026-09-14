import type { Request } from "express";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";
import * as dining from "../services/dining.service";
function sessionToken(req: Request) {
  const token = req.get("X-Dining-Token");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError("Scan and reserve your chair first.", 401, "DINING_SESSION_REQUIRED");
  return token;
}
async function restaurantId(req: Request) { return (await dining.resolveQr(String(req.params.qrToken))).restaurantId; }
export const context = asyncHandler(async (req, res) => { res.json(await dining.getContext(String(req.params.qrToken))); });
export const hold = asyncHandler(async (req, res) => { res.status(201).json(await dining.holdSeats(await restaurantId(req), req.body)); });
export const session = asyncHandler(async (req, res) => { res.json(await dining.getSession(await restaurantId(req), sessionToken(req))); });
export const order = asyncHandler(async (req, res) => { res.json(await dining.submitOrder(await restaurantId(req), sessionToken(req), req.body)); });
export const cancel = asyncHandler(async (req, res) => { res.json(await dining.cancelOrder(await restaurantId(req), sessionToken(req), req.body)); });
export const list = asyncHandler(async (req, res) => { res.json(await dining.listSeating(req.user!.restaurantId)); });
export const staffHold = asyncHandler(async (req, res) => { res.status(201).json(await dining.holdSeats(req.user!.restaurantId, req.body, req.user!.userId)); });
export const release = asyncHandler(async (req, res) => { res.json(await dining.releaseSession(req.user!.restaurantId, String(req.params.id), req.user!.userId, req.body.reason)); });
export const policy = asyncHandler(async (req, res) => { res.json(await dining.updatePolicy(req.user!.restaurantId, req.body)); });
export const preparation = asyncHandler(async (req, res) => { res.json(await dining.updatePreparation(req.user!.restaurantId, String(req.params.id), req.body.prepMinutes)); });
export const eta = asyncHandler(async (req, res) => { res.json(await dining.updateEta(req.user!.restaurantId, String(req.params.id), String(req.params.itemId), req.body.minutes)); });
export const qr = asyncHandler(async (req, res) => { res.json(await dining.chairQrCodes(req.user!.restaurantId, String(req.params.id))); });
export const staffOrder = asyncHandler(async (req, res) => { res.json(await dining.staffSessionOrder(req.user!.restaurantId, String(req.params.id), req.user!.userId)); });
