export type NotificationCategory = "orders" | "kitchen" | "service" | "billing" | "system";
export type NotificationPriority = "info" | "action" | "required" | "urgent";

export interface StaffNotification {
  id: string; category: NotificationCategory; eventType: string; title: string; message: string;
  priority: NotificationPriority; actionUrl: string | null;
  entity: { type: string; id: string } | null;
  context: { tableLabel?: string; chairLabel?: string } | null;
  createdAt: string; read: boolean;
}
export interface NotificationPage { notifications: StaffNotification[]; nextCursor: string | null; unreadCount: number }
export interface NotificationCounts { total: number; byCategory: Partial<Record<NotificationCategory, number>> }
