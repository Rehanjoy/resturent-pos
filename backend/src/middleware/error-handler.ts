import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";

/**
 * Central error handler. Every controller error (thrown or passed to
 * `next(error)`) lands here so API error responses stay consistent:
 * { success: false, message, code }
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : 500;
  const code = isAppError ? error.code : "INTERNAL_ERROR";
  const message =
    isAppError || env.nodeEnv !== "production"
      ? (error as Error).message
      : "Something went wrong. Please try again.";

  if (!isAppError) {
    console.error("[error]", error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
}
