/** Mirrors `backend/src/services/sales-analytics.service.ts` and
 * `dashboard.service.ts` DTOs. */

export type PaymentMode = "cash" | "card" | "upi";
export type TableStatus = "free" | "occupied" | "reserved" | "needs_cleaning";

export interface SalesTotals {
  grossRevenue: number;
  netRevenue: number;
  totalTax: number;
  totalDiscounts: number;
  invoiceCount: number;
}

export interface PaymentModeAmount {
  mode: PaymentMode;
  amount: number;
}

export interface LiveOps {
  tables: Record<TableStatus, number>;
  ordersInKitchen: number;
  ordersReadyToServe: number;
}

export interface TopDish {
  menuItemId: string;
  name: string;
  qtySold: number;
  revenue: number;
}

export interface CategoryRevenue {
  categoryId: string;
  name: string;
  qtySold: number;
  revenue: number;
}

export interface DailyRevenue {
  date: string;
  grossRevenue: number;
}

export interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number;
}

export interface DashboardSummary {
  salesSummary: SalesTotals;
  paymentModeBreakdown: PaymentModeAmount[];
  liveOps: LiveOps;
  topDishes: TopDish[];
  topCategories: CategoryRevenue[];
  weeklyTrend: DailyRevenue[];
  lowStockCount: number;
  lowStockItems: LowStockItem[];
}
