import { z } from "zod";
import { NOTIFICATION_CATEGORIES } from "../models/notification.model";

const identifier = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid identifier.");
export const notificationListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  cursor: identifier.optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  unread: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).strict();
export const notificationIdParams = z.object({ id: identifier }).strict();
export const guestNotificationParams = z.object({ qrToken: z.string().min(16).max(160), id: identifier.optional() }).strict();
export const guestNotificationQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(30), cursor: identifier.optional() }).strict();
