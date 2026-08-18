import { resolveDateRange, type ReportRange } from "../utils/date-range";
import { toCsv } from "../utils/csv";
import * as analytics from "./sales-analytics.service";

const TOP_DISHES_LIMIT = 10;
const SLOW_MOVING_LIMIT = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isSingleDayRange(from: Date, to: Date): boolean {
  return to.getTime() - from.getTime() < ONE_DAY_MS;
}

function formatRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

export interface SalesReportDto {
  from: string;
  to: string;
  /** Whether `revenueByHour` was computed — only meaningful for a range
   * that spans a single calendar day (PRD §3.12 "Revenue by hour (for
   * single-day ranges)"). `revenueByHour` is an empty array when `false`. */
  isSingleDay: boolean;
  totals: analytics.SalesTotals;
  revenueByHour: analytics.HourlyRevenue[];
  revenueByCategory: analytics.CategoryRevenue[];
  revenueByPaymentMode: analytics.PaymentModeAmount[];
}

/** `GET /api/reports/sales` (PRD §3.12 "Revenue by hour, by category, by
 * payment mode"). Owner/Manager/Cashier — see `report.routes.ts`. */
export async function getSalesReport(
  restaurantId: string,
  range: ReportRange,
  from?: string,
  to?: string,
): Promise<SalesReportDto> {
  const bounds = resolveDateRange(range, from, to);
  const singleDay = isSingleDayRange(bounds.from, bounds.to);

  const [totals, revenueByCategory, revenueByPaymentMode, revenueByHour] = await Promise.all([
    analytics.aggregateSalesTotals(restaurantId, bounds.from, bounds.to),
    analytics.aggregateCategoryRevenue(restaurantId, bounds.from, bounds.to),
    analytics.aggregatePaymentModeBreakdown(restaurantId, bounds.from, bounds.to),
    singleDay
      ? analytics.aggregateRevenueByHour(restaurantId, bounds.from, bounds.to)
      : Promise.resolve([]),
  ]);

  return {
    from: bounds.from.toISOString(),
    to: bounds.to.toISOString(),
    isSingleDay: singleDay,
    totals,
    revenueByHour,
    revenueByCategory,
    revenueByPaymentMode,
  };
}

export interface TopDishesReportDto {
  from: string;
  to: string;
  topDishes: analytics.TopDish[];
  slowMovingDishes: analytics.TopDish[];
}

/**
 * `GET /api/reports/top-dishes` (PRD §3.12 "Top-performing dishes and
 * slow-moving items"). Owner/Manager/Cashier.
 *
 * Slow-moving definition (documented judgment call): dishes that sold at
 * least one unit within the selected range, ranked lowest-quantity-first,
 * capped at 10. Dishes with zero sales in the range are deliberately
 * excluded rather than ranked as "slowest" — a dish with 0 sales might not
 * even have been on the menu/available that day, and correctly flagging
 * that requires left-joining against `MenuItem.isAvailable` history this
 * codebase doesn't track. A fuller "never sold" report is a reasonable
 * follow-up, out of scope here.
 */
export async function getTopDishesReport(
  restaurantId: string,
  range: ReportRange,
  from?: string,
  to?: string,
): Promise<TopDishesReportDto> {
  const bounds = resolveDateRange(range, from, to);

  const [topDishes, slowMovingDishes] = await Promise.all([
    analytics.aggregateTopDishes(restaurantId, bounds.from, bounds.to, TOP_DISHES_LIMIT, "top"),
    analytics.aggregateTopDishes(
      restaurantId,
      bounds.from,
      bounds.to,
      SLOW_MOVING_LIMIT,
      "bottom",
    ),
  ]);

  return { from: bounds.from.toISOString(), to: bounds.to.toISOString(), topDishes, slowMovingDishes };
}

export interface StaffPerformanceReportDto {
  from: string;
  to: string;
  staff: analytics.StaffPerformanceEntry[];
}

/** `GET /api/reports/staff-performance` (PRD §3.12). Owner/Manager only —
 * enforced independently at the route level, never exposed to Cashier even
 * via a shared/generic report path (see `report.routes.ts`). */
export async function getStaffPerformanceReport(
  restaurantId: string,
  range: ReportRange,
  from?: string,
  to?: string,
): Promise<StaffPerformanceReportDto> {
  const bounds = resolveDateRange(range, from, to);
  const staff = await analytics.aggregateStaffPerformance(restaurantId, bounds.from, bounds.to);
  return { from: bounds.from.toISOString(), to: bounds.to.toISOString(), staff };
}

export interface ExportResult {
  filename: string;
  csv: string;
}

/**
 * `GET /api/reports/export?report=sales|top-dishes&format=csv` (PRD §3.12
 * "Export to CSV/Excel/PDF"). CSV only for this MVP — Excel and PDF export
 * are a documented follow-up rather than half-built here; CSV already
 * covers "open this in a spreadsheet", which is the actual need behind the
 * PRD line item. Money columns are rendered as decimal rupees (not raw
 * paise) since this file's audience is opening it directly in a
 * spreadsheet, matching the `formatRupees` convention already used for the
 * invoice PDF (`utils/invoice-pdf.ts`) and payment confirmations
 * (`payment.service.ts`).
 */
export async function exportReportCsv(
  restaurantId: string,
  reportType: "sales" | "top-dishes",
  range: ReportRange,
  from?: string,
  to?: string,
): Promise<ExportResult> {
  const bounds = resolveDateRange(range, from, to);
  const dateStamp = bounds.from.toISOString().slice(0, 10);

  if (reportType === "sales") {
    const report = await getSalesReport(restaurantId, range, from, to);
    const headers = ["section", "label", "value"];
    const rows = [
      { section: "Totals", label: "Gross Revenue (INR)", value: formatRupees(report.totals.grossRevenue) },
      { section: "Totals", label: "Net Revenue (INR)", value: formatRupees(report.totals.netRevenue) },
      { section: "Totals", label: "Total Tax (INR)", value: formatRupees(report.totals.totalTax) },
      {
        section: "Totals",
        label: "Total Discounts (INR)",
        value: formatRupees(report.totals.totalDiscounts),
      },
      { section: "Totals", label: "Invoice Count", value: report.totals.invoiceCount },
      ...report.revenueByCategory.map((category) => ({
        section: "Revenue by Category",
        label: category.name,
        value: formatRupees(category.revenue),
      })),
      ...report.revenueByPaymentMode.map((mode) => ({
        section: "Revenue by Payment Mode",
        label: mode.mode.toUpperCase(),
        value: formatRupees(mode.amount),
      })),
      ...report.revenueByHour.map((hour) => ({
        section: "Revenue by Hour",
        label: `${String(hour.hour).padStart(2, "0")}:00`,
        value: formatRupees(hour.revenue),
      })),
    ];
    return { filename: `sales-report-${dateStamp}.csv`, csv: toCsv(headers, rows) };
  }

  const report = await getTopDishesReport(restaurantId, range, from, to);
  const headers = ["section", "rank", "dish", "qtySold", "revenueInr"];
  const rows = [
    ...report.topDishes.map((dish, index) => ({
      section: "Top Dishes",
      rank: index + 1,
      dish: dish.name,
      qtySold: dish.qtySold,
      revenueInr: formatRupees(dish.revenue),
    })),
    ...report.slowMovingDishes.map((dish, index) => ({
      section: "Slow Moving",
      rank: index + 1,
      dish: dish.name,
      qtySold: dish.qtySold,
      revenueInr: formatRupees(dish.revenue),
    })),
  ];
  return { filename: `top-dishes-report-${dateStamp}.csv`, csv: toCsv(headers, rows) };
}
