import { Schema, model, type Types } from "mongoose";
import { STAFF_MODULES, USER_ROLES, type StaffModule, type UserRole } from "./user.model";

export const NOTIFICATION_CATEGORIES = ["orders", "kitchen", "service", "billing", "system"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NOTIFICATION_PRIORITIES = ["info", "action", "required", "urgent"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export interface NotificationDocument {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  requiredModule?: StaffModule;
  targetRoles: UserRole[];
  targetUserIds: Types.ObjectId[];
  targetDiningSessionId?: string;
  entity?: { type: string; id: string };
  actionUrl?: string;
  context?: { tableLabel?: string; chairLabel?: string };
  dedupeKey: string;
  readByStaffIds: Types.ObjectId[];
  guestReadAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<NotificationDocument>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true },
  category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
  eventType: { type: String, required: true, trim: true, maxlength: 80 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 320 },
  priority: { type: String, enum: NOTIFICATION_PRIORITIES, required: true, default: "info" },
  requiredModule: { type: String, enum: STAFF_MODULES },
  targetRoles: { type: [{ type: String, enum: USER_ROLES }], default: [] },
  targetUserIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
  targetDiningSessionId: { type: String, trim: true, index: true },
  entity: { type: { type: String, trim: true, maxlength: 40 }, id: { type: String, trim: true, maxlength: 80 }, _id: false },
  actionUrl: { type: String, trim: true, maxlength: 240 },
  context: { tableLabel: { type: String, trim: true, maxlength: 80 }, chairLabel: { type: String, trim: true, maxlength: 120 }, _id: false },
  dedupeKey: { type: String, required: true, trim: true, maxlength: 180 },
  readByStaffIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
  guestReadAt: Date,
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

schema.index({ restaurantId: 1, dedupeKey: 1 }, { unique: true });
schema.index({ restaurantId: 1, createdAt: -1 });
schema.index({ restaurantId: 1, targetRoles: 1, createdAt: -1 });
schema.index({ restaurantId: 1, targetUserIds: 1, createdAt: -1 });
schema.index({ restaurantId: 1, targetDiningSessionId: 1, createdAt: -1 });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Notification = model<NotificationDocument>("Notification", schema);
