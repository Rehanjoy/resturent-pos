import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TwoFactorTokenPayload,
} from "../types/auth";

const TWO_FACTOR_TOKEN_EXPIRY = "5m";

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiry as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiry as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}

/**
 * Interim token issued between "password correct" and "2FA verified".
 * Reuses the access-token signing secret (with a distinct `purpose` claim
 * and a 5 minute expiry) instead of introducing a third JWT secret just
 * for this narrow, short-lived use case.
 */
export function signTwoFactorToken(userId: string): string {
  const payload: TwoFactorTokenPayload = { userId, purpose: "2fa-login" };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: TWO_FACTOR_TOKEN_EXPIRY,
  });
}

export function verifyTwoFactorToken(token: string): TwoFactorTokenPayload {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as TwoFactorTokenPayload;
  if (decoded.purpose !== "2fa-login") {
    throw new Error("Token is not a valid 2FA session token.");
  }
  return decoded;
}

/** Reads the `exp` claim off an already-signed token without verifying it. */
export function decodeTokenExpiry(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string" || !decoded.exp) {
    throw new Error("Token has no expiry claim.");
  }
  return new Date(decoded.exp * 1000);
}
