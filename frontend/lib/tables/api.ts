import { api } from "@/lib/api";
import type { Area, RestaurantTable, TableShape, TableStatus } from "./types";

/**
 * Typed endpoint calls for the Tables & Areas module, all going through
 * the single transport client in `lib/api.ts` (same pattern as
 * `lib/auth/api.ts`).
 */
export const areasApi = {
  list: () => api.get<{ areas: Area[] }>("/api/areas"),

  create: (input: { name: string; displayOrder?: number }) =>
    api.post<{ area: Area }>("/api/areas", input),

  update: (id: string, input: { name?: string; displayOrder?: number }) =>
    api.patch<{ area: Area }>(`/api/areas/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/areas/${id}`),
};

export const tablesApi = {
  list: (areaId?: string) =>
    api.get<{ tables: RestaurantTable[] }>(
      `/api/tables${areaId ? `?areaId=${encodeURIComponent(areaId)}` : ""}`,
    ),

  create: (input: {
    areaId: string;
    name: string;
    seatingCapacity: number;
    shape: TableShape;
  }) => api.post<{ table: RestaurantTable }>("/api/tables", input),

  update: (
    id: string,
    input: Partial<{
      areaId: string;
      name: string;
      seatingCapacity: number;
      shape: TableShape;
    }>,
  ) => api.patch<{ table: RestaurantTable }>(`/api/tables/${id}`, input),

  remove: (id: string) => api.delete<{ message: string }>(`/api/tables/${id}`),

  updateStatus: (id: string, status: TableStatus) =>
    api.patch<{ table: RestaurantTable }>(`/api/tables/${id}/status`, { status }),
};
