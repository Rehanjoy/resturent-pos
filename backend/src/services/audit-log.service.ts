import type { Types } from "mongoose";
import { AuditLog } from "../models/audit-log.model";

interface RecordAuditLogInput {
  restaurantId: Types.ObjectId;
  staffId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}

/**
 * The only write path into the append-only audit trail (PRD §7). Every
 * module that touches financial or security-sensitive state — discounts,
 * voids, refunds, price edits, and (here) auth/session events — should log
 * through this one function.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await AuditLog.create(input);
}
