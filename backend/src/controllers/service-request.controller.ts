import { asyncHandler } from "../utils/async-handler";
import * as service from "../services/service-request.service";

export const createGuestRequest = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createGuestServiceRequest(String(req.params.qrToken), req.get("X-Dining-Token")!, req.body));
});
export const listGuestRequests = asyncHandler(async (req, res) => {
  res.json(await service.listGuestServiceRequests(String(req.params.qrToken), req.get("X-Dining-Token")!));
});
export const listStaffRequests = asyncHandler(async (req, res) => {
  res.json(await service.listStaffServiceRequests(req.user!.restaurantId));
});
export const updateRequest = asyncHandler(async (req, res) => {
  res.json(await service.updateServiceRequest(req.user!.restaurantId, String(req.params.id), req.user!.userId, req.body.status));
});
