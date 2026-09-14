import { api } from "@/lib/api";
import type { NotificationCategory, NotificationCounts, NotificationPage, StaffNotification } from "./types";

export const notificationsApi = {
  list: (input: { category?: NotificationCategory; unread?: boolean; limit?: number; cursor?: string } = {}) => {
    const query = new URLSearchParams({ limit: String(input.limit ?? 40) });
    if (input.category) query.set("category", input.category);
    if (input.unread) query.set("unread", "true");
    if (input.cursor) query.set("cursor", input.cursor);
    return api.get<NotificationPage>(`/api/notifications?${query}`);
  },
  unreadCounts: () => api.get<NotificationCounts>("/api/notifications/unread-counts"),
  markRead: (id: string) => api.patch<{ notification: StaffNotification }>(`/api/notifications/${id}/read`),
  markAllRead: () => api.post<{ updated: number }>("/api/notifications/read-all"),
};
