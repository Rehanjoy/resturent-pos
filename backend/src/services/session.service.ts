import type { Types } from "mongoose";
import { Session, type SessionDocument } from "../models/session.model";
import { hashToken } from "../utils/tokens";

interface CreateSessionInput {
  userId: Types.ObjectId;
  refreshToken: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<SessionDocument> {
  return Session.create({
    userId: input.userId,
    refreshTokenHash: hashToken(input.refreshToken),
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    expiresAt: input.expiresAt,
  });
}

export async function findSessionByRefreshToken(
  refreshToken: string,
): Promise<SessionDocument | null> {
  return Session.findOne({ refreshTokenHash: hashToken(refreshToken) });
}

export async function revokeSession(sessionId: Types.ObjectId): Promise<void> {
  await Session.updateOne(
    { _id: sessionId, revokedAt: null },
    { revokedAt: new Date() },
  );
}

/**
 * Kills every active session for a user. Used both for admin-initiated
 * "revoke all sessions" (future Staff module) and refresh-token reuse
 * detection (see `auth.service.ts`), where a rotated-out token showing up
 * again means the token was very likely stolen/leaked.
 */
export async function revokeAllSessionsForUser(
  userId: Types.ObjectId,
): Promise<void> {
  await Session.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() },
  );
}
