import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import { verifyAccessToken } from "../utils/jwt";

/**
 * Verifies the `Authorization: Bearer <accessToken>` header and attaches
 * the decoded claims to `req.user`. Every downstream handler (and the
 * `authorize` middleware) reads role/restaurantId from `req.user`, which
 * only this middleware is allowed to set — never trust a client-supplied
 * role/restaurantId from the body/query/params (PRD §2).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    next(new AppError("Authentication required.", 401, "UNAUTHENTICATED"));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(
      new AppError(
        "Invalid or expired session. Please log in again.",
        401,
        "INVALID_TOKEN",
      ),
    );
  }
}
