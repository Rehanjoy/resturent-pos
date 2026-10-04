import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { env } from "../config/env";
import * as authService from "../services/auth.service";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/";
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, refreshToken: string): void {
  const isProduction = env.nodeEnv === "production";
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  const isProduction = env.nodeEnv === "production";
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
  });
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login({
    email: req.body.email,
    password: req.body.password,
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  });

  if (result.twoFactorRequired) {
    res.status(200).json({
      twoFactorRequired: true,
      twoFactorToken: result.twoFactorToken,
    });
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({
    twoFactorRequired: false,
    accessToken: result.accessToken,
    user: result.user,
  });
});

export const verifyTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.completeTwoFactorLogin({
    twoFactorToken: req.body.twoFactorToken,
    code: req.body.code,
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  });

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
});

export const pinLogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.pinLogin({
    restaurantId: req.body.restaurantId,
    staffId: req.body.staffId,
    pin: req.body.pin,
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  });

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
});

export const listPinLoginStaff = asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = req.query.restaurantId as string | undefined;
  const result = await authService.getStaffForPinPicker(restaurantId);
  res.status(200).json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refreshSession({
    refreshToken: readRefreshCookie(req),
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  });

  setRefreshCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout({ refreshToken: readRefreshCookie(req) });
  clearRefreshCookie(res);
  res.status(200).json({ message: "Logged out." });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user!.userId);
  res.status(200).json(user);
});

export const setupTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const data = await authService.setupTwoFactor(req.user!.userId);
  res.status(200).json(data);
});

export const enableTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  await authService.enableTwoFactor(req.user!.userId, req.body.code);
  res.status(200).json({ message: "Two-factor authentication enabled." });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.user!.userId, req.body.newPassword);
  res.status(200).json({ message: "Password updated." });
});

export const startDemo = asyncHandler(async (req: Request, res: Response) => {
  const { email, name } = req.body || {};
  const meta = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };

  const { accessToken, refreshToken, user } = await authService.createDemoSession(
    email,
    name,
    meta,
  );

  setRefreshCookie(res, refreshToken);
  res.status(200).json({ accessToken, user });
});

