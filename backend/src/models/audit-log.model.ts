import { Schema, model, type Types } from "mongoose";

export interface AuditLogDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  staffId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  createdAt: Date;
}

/**
 * Append-only audit trail (PRD §7 "Immutable audit logging"). Every
 * financial/security-sensitive action across every module (discounts,
 * voids, refunds, price edits, auth/session events) records through this
 * one schema. Deliberately no update/delete anywhere in the codebase for
 * this model — only `AuditLog.create(...)` (via `audit-log.service.ts`)
 * and read queries. Do not add a findOneAndUpdate/deleteOne/deleteMany
 * usage against this collection.
 */
const auditLogSchema = new Schema<AuditLogDocument>(
  {
    restaurantId: {
      type: Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    staffId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String },
    beforeValue: { type: Schema.Types.Mixed },
    afterValue: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ restaurantId: 1, createdAt: -1 });

export const AuditLog = model<AuditLogDocument>("AuditLog", auditLogSchema);
