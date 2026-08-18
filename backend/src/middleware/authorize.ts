import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error";
import type { UserRole } from "../models/user.model";

/**
 * Role-guard middleware factory — usage: `authorize("owner", "manager")`.
 * Must run after `authenticate`. Reads only the server-verified JWT claim
 * on `req.user.role`; every future module route uses this same pattern so
 * role checks live in one place instead of being reimplemented per
 * controller (PRD §2 RBAC matrix).
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication required.", 401, "UNAUTHENTICATED"));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(
        new AppError(
          "You do not have permission to perform this action.",
          403,
          "FORBIDDEN",
        ),
      );
      return;
    }
    next();
  };
}
