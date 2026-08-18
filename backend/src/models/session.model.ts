import { Schema, model, type Types } from "mongoose";

export interface SessionDocument {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}

/**
 * One row per issued refresh token — this is what powers "Admin can view &
 * revoke active sessions per staff" (PRD §3.1) and refresh-token rotation
 * with reuse detection (see `auth.service.ts`). The raw refresh token is
 * never stored, only a SHA-256 hash of it, so a database read can never
 * hand out a usable token.
 */
const sessionSchema = new Schema<SessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    refreshTokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ userId: 1, revokedAt: 1 });
// TTL cleanup — MongoDB removes the document once `expiresAt` passes so
// stale/expired sessions don't accumulate forever.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = model<SessionDocument>("Session", sessionSchema);
