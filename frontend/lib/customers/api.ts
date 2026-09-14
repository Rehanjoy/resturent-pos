import { api } from "@/lib/api";
import type { CustomerDetail, CustomerSummary, ServiceTag } from "./types";
export const customersApi = {
  list: (search = "", page = 1) => api.get<{ customers: CustomerSummary[]; total: number; page: number; totalPages: number }>(`/api/customers?search=${encodeURIComponent(search)}&page=${page}`),
  detail: (id: string) => api.get<CustomerDetail>(`/api/customers/${id}`),
  update: (id: string, serviceTag: ServiceTag, serviceNotes: string) => api.patch<CustomerDetail>(`/api/customers/${id}`, { serviceTag, serviceNotes }),
};
