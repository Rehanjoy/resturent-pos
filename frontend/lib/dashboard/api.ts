import { api } from "@/lib/api";
import type { DashboardSummary } from "./types";

export const dashboardApi = {
  getSummary: () => api.get<{ summary: DashboardSummary }>("/api/dashboard/summary"),
};
