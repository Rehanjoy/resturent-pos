import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../utils/app-error";

type ValidationSource = "body" | "query" | "params";

/**
 * Validates `req[source]` against a Zod schema before the controller runs
 * (PRD §7 "Input validation on every API input"). On success, replaces
 * `req[source]` with the parsed/coerced data so controllers can trust
 * types and defaults straight off the request object.
 */
export function validate(schema: ZodType, source: ValidationSource = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || source}: ${issue.message}`)
        .join("; ");
      next(new AppError(message, 400, "VALIDATION_ERROR"));
      return;
    }

    if (source === "query") {
      // Express 5's `req.query` is a getter-only accessor (no setter), so
      // it can't be reassigned like `req.body` can — mutate the object it
      // already points to instead.
      Object.assign(req.query, result.data);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any)[source] = result.data;
    }
    next();
  };
}
