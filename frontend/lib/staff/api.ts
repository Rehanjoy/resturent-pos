import { api } from "@/lib/api";
import type { StaffActivityLogEntry, StaffMember, StaffRole, StaffSession } from "./types";

export interface CreateStaffInput {
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  password?: string;
}

export interface UpdateStaffInput {
  name?: string;
  phone?: string;
  role?: StaffRole;
}

/**
 * Typed endpoint calls for the Staff Management module, all going through
 * the single transport client in `lib/api.ts` (same pattern as
 * `lib/tables/api.ts`).
 */
export const staffApi = {
  list: () => api.get<{ staff: StaffMember[] }>("/api/staff"),

  get: (id: string) => api.get<{ staff: StaffMember }>(`/api/staff/${id}`),

  create: (input: CreateStaffInput) =>
    api.post<{ staff: StaffMember; temporaryPassword?: string }>("/api/staff", input),

  update: (id: string, input: UpdateStaffInput) =>
    api.patch<{ staff: StaffMember }>(`/api/staff/${id}`, input),

  deactivate: (id: string) =>
    api.patch<{ staff: StaffMember }>(`/api/staff/${id}/deactivate`),

  reactivate: (id: string) =>
    api.patch<{ staff: StaffMember }>(`/api/staff/${id}/reactivate`),

  activityLog: (id: string, page = 1, limit = 20) =>
    api.get<{ logs: StaffActivityLogEntry[]; page: number; limit: number; total: number }>(
      `/api/staff/${id}/activity-log?page=${page}&limit=${limit}`,
    ),

  sessions: (id: string) => api.get<{ sessions: StaffSession[] }>(`/api/staff/${id}/sessions`),

  revokeSession: (id: string, sessionId: string) =>
    api.post<{ message: string }>(`/api/staff/${id}/sessions/${sessionId}/revoke`),
};
