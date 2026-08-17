"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface HealthResponse {
  status: string;
}

/**
 * Trivial React Query wiring example — confirms the frontend can reach the
 * backend's `/api/health` route. Real data hooks for orders, tables, etc.
 * follow this same pattern in later parts.
 */
export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<HealthResponse>("/api/health"),
    retry: false,
  });
}
