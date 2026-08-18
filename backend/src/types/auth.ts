import type { UserRole } from "../models/user.model";

/**
 * Claims signed into the short-lived access token. Every RBAC-guarded
 * route reads `role`/`restaurantId` from here (via `req.user`, set by the
 * `authenticate` middleware) — never from the request body/params/query.
 */
export interface AccessTokenPayload {
  userId: string;
  restaurantId: string;
  role: UserRole;
}

/**
 * Claims signed into the long-lived refresh token (httpOnly cookie only).
 * `jti` is a random per-token id — without it, two tokens signed for the
 * same user in the same second would be byte-identical (jsonwebtoken's
 * `iat`/`exp` only have second granularity), which would collide against
 * the unique index on `sessions.refreshTokenHash`.
 */
export interface RefreshTokenPayload {
  userId: string;
  jti: string;
}

/**
 * Claims for the short-lived interim token issued after a correct
 * password but before 2FA is verified. Deliberately carries no
 * `restaurantId`/`role` — those are only granted once 2FA succeeds.
 */
export interface TwoFactorTokenPayload {
  userId: string;
  purpose: "2fa-login";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
