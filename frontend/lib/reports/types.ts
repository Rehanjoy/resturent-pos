/** Mirrors `backend/src/services/report.service.ts` and
 * `sales-analytics.service.ts` DTOs. */
import type { CategoryRevenue, PaymentModeAmount, SalesTotals, TopDish } from "@/lib/dashboard/types";

export const REPORT_RANGES = ["today", "yesterday", "7d", "month", "custom"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface HourlyRevenue {
  hour: number;
  revenue: number;
}

export interface SalesReport {
  from: string;
  to: string;
  isSingleDay: boolean;
  totals: SalesTotals;
  revenueByHour: HourlyRevenue[];
  revenueByCategory: CategoryRevenue[];
  revenueByPaymentMode: PaymentModeAmount[];
}

export interface TopDishesReport {
  from: string;
  to: string;
  topDishes: TopDish[];
  slowMovingDishes: TopDish[];
}

export interface StaffPerformanceEntry {
  staffId: string;
  name: string;
  role: string;
  ordersCreated: number;
  ordersServed: number;
  avgTurnaroundMinutes: number | null;
}

export interface StaffPerformanceReport {
  from: string;
  to: string;
  staff: StaffPerformanceEntry[];
}

export interface ReportRangeParams {
  range: ReportRange;
  from?: string;
  to?: string;
}
