import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import * as staffService from "../services/staff.service";

export const listStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.listStaff(req.user!.restaurantId);
  res.status(200).json({ staff });
});

export const getStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.getStaffDetail(req.user!.restaurantId, String(req.params.id));
  res.status(200).json({ staff });
});

export const createStaff = asyncHandler(async (req: Request, res: Response) => {
  const result = await staffService.createStaff(req.user!.restaurantId, req.user!.role, req.body);
  res.status(201).json(result);
});

export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.updateStaff(
    req.user!.restaurantId,
    req.user!.role,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ staff });
});

export const deactivateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.setStaffActiveStatus(
    req.user!.restaurantId,
    req.user!.role,
    req.user!.userId,
    String(req.params.id),
    false,
  );
  res.status(200).json({ staff });
});

export const reactivateStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await staffService.setStaffActiveStatus(
    req.user!.restaurantId,
    req.user!.role,
    req.user!.userId,
    String(req.params.id),
    true,
  );
  res.status(200).json({ staff });
});

export const getStaffActivityLog = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const result = await staffService.getStaffActivityLog(
    req.user!.restaurantId,
    String(req.params.id),
    page,
    limit,
  );
  res.status(200).json(result);
});

export const listStaffSessions = asyncHandler(async (req: Request, res: Response) => {
  const sessions = await staffService.listStaffSessions(
    req.user!.restaurantId,
    req.user!.role,
    String(req.params.id),
  );
  res.status(200).json({ sessions });
});

export const revokeStaffSession = asyncHandler(async (req: Request, res: Response) => {
  await staffService.revokeStaffSession(
    req.user!.restaurantId,
    req.user!.role,
    req.user!.userId,
    String(req.params.id),
    String(req.params.sessionId),
  );
  res.status(200).json({ message: "Session revoked." });
});
