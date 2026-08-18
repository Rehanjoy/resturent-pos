import { Types, type PipelineStage } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { Payment, PAYMENT_MODES, type PaymentMode } from "../models/payment.model";
import { Table, TABLE_STATUSES, type TableStatus } from "../models/table.model";
import { Order } from "../models/order.model";
import { User, type UserRole } from "../models/user.model";

/**
 * Shared aggregation building blocks for the Dashboard and Reports modules
 * (`dashboard.service.ts`, `report.service.ts`). Both modules query the
 * same handful of collections (Invoice/Payment/Table/Order/User) sliced by
 * different date windows, so the pipelines live here once instead of being
 * copy-pasted per endpoint.
 *
 * Every pipeline below starts its `$match` with `restaurantId` cast to a
 * `Types.ObjectId` explicitly — unlike `Model.find()`, `Model.aggregate()`
 * does NOT run Mongoose's schema-based auto-casting on `$match` filters, so
 * passing the raw string here would silently match zero documents (fail
 * safe) rather than leak cross-tenant data, but every pipeline is written
 * to cast explicitly regardless, to keep this correct and unambiguous.
 */

export interface SalesTotals {
  /** Sum of `Invoice.subtotal` — item revenue before discount and tax. */
  grossRevenue: number;
  /** `grossRevenue - totalDiscounts` — revenue after discount, before tax. */
  netRevenue: number;
  totalTax: number;
  totalDiscounts: number;
  invoiceCount: number;
}

const EMPTY_TOTALS: SalesTotals = {
  grossRevenue: 0,
  netRevenue: 0,
  totalTax: 0,
  totalDiscounts: 0,
  invoiceCount: 0,
};

/**
 * Today's/range's sales summary (PRD §3.2, §3.12). Only counts `issued`
 * invoices — a voided bill never contributes revenue, tax, or discount.
 */
export async function aggregateSalesTotals(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<SalesTotals> {
  const [result] = await Invoice.aggregate<{
    grossRevenue: number;
    totalDiscounts: number;
    totalTax: number;
    invoiceCount: number;
  }>([
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        status: "issued",
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: "$subtotal" },
        totalDiscounts: { $sum: { $ifNull: ["$discount.amountApplied", 0] } },
        totalTax: {
          $sum: {
            $reduce: {
              input: "$taxLines",
              initialValue: 0,
              in: { $add: ["$$value", "$$this.amount"] },
            },
          },
        },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);

  if (!result) return { ...EMPTY_TOTALS };

  return {
    grossRevenue: result.grossRevenue,
    totalDiscounts: result.totalDiscounts,
    totalTax: result.totalTax,
    invoiceCount: result.invoiceCount,
    netRevenue: result.grossRevenue - result.totalDiscounts,
  };
}

export interface PaymentModeAmount {
  mode: PaymentMode;
  amount: number;
}

/** Payment mode breakdown (PRD §3.2/§3.12) — money actually collected, by
 * `Payment.createdAt`, not by when the underlying invoice was issued. */
export async function aggregatePaymentModeBreakdown(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<PaymentModeAmount[]> {
  const results = await Payment.aggregate<{ _id: PaymentMode; amount: number }>([
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        createdAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: "$mode", amount: { $sum: "$amount" } } },
  ]);

  const byMode = new Map(results.map((r) => [r._id, r.amount]));
  // Always return every configured mode, zero-filled, so the chart has a
  // stable set of bars even on a day with (say) zero UPI transactions.
  return PAYMENT_MODES.map((mode) => ({ mode, amount: byMode.get(mode) ?? 0 }));
}

export interface LiveOps {
  tables: Record<TableStatus, number>;
  ordersInKitchen: number;
  ordersReadyToServe: number;
}

/** Live operations widget (PRD §3.2) — current-moment counts, not scoped to
 * any date range. */
export async function getLiveOps(restaurantId: string): Promise<LiveOps> {
  const restaurantObjectId = new Types.ObjectId(restaurantId);

  const [tableCounts, ordersInKitchen, ordersReadyToServe] = await Promise.all([
    Table.aggregate<{ _id: TableStatus; count: number }>([
      { $match: { restaurantId: restaurantObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // "sent" and "in_kitchen" both mean the kitchen currently has the
    // ticket (see order.model.ts state-machine doc comment).
    Order.countDocuments({ restaurantId, status: { $in: ["sent", "in_kitchen"] } }),
    Order.countDocuments({ restaurantId, status: "ready" }),
  ]);

  const byStatus = new Map(tableCounts.map((t) => [t._id, t.count]));
  const tables = Object.fromEntries(
    TABLE_STATUSES.map((status) => [status, byStatus.get(status) ?? 0]),
  ) as Record<TableStatus, number>;

  return { tables, ordersInKitchen, ordersReadyToServe };
}

export interface TopDish {
  menuItemId: string;
  name: string;
  qtySold: number;
  revenue: number;
}

/**
 * Top/slow-moving dishes. Source is `Invoice.items`, not `Order.items` —
 * documented judgment call (see `dashboard.service.ts` / handover report):
 * an invoice is the finalized, paid-adjacent record of what was actually
 * sold, so a still-in-progress draft order or an order voided before
 * billing never counts as a "sale" here. `direction: "bottom"` sorts
 * ascending for the Reports "slow-moving items" view — see
 * `report.service.ts` for the exact definition used.
 */
export async function aggregateTopDishes(
  restaurantId: string,
  from: Date,
  to: Date,
  limit: number,
  direction: "top" | "bottom" = "top",
): Promise<TopDish[]> {
  const results = await Invoice.aggregate<{
    _id: Types.ObjectId;
    name: string;
    qtySold: number;
    revenue: number;
  }>([
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        status: "issued",
        createdAt: { $gte: from, $lte: to },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.menuItemId",
        name: { $first: "$items.nameSnapshot" },
        qtySold: { $sum: "$items.qty" },
        revenue: { $sum: { $multiply: ["$items.qty", "$items.priceSnapshot"] } },
      },
    },
    { $sort: { qtySold: direction === "top" ? -1 : 1 } },
    { $limit: limit },
  ]);

  return results.map((r) => ({
    menuItemId: r._id.toString(),
    name: r.name,
    qtySold: r.qtySold,
    revenue: r.revenue,
  }));
}

export interface CategoryRevenue {
  categoryId: string;
  name: string;
  qtySold: number;
  revenue: number;
}

/**
 * Top-selling categories, joined `Invoice.items.menuItemId -> MenuItem ->
 * Category`. The `$lookup` against `menuitems`/`categories` is safe without
 * re-filtering by `restaurantId` inside the lookup: every `menuItemId` ever
 * written onto an order/invoice item was validated against this same
 * restaurant's menu at add-item time (`order.service.ts` `editOrderItems`),
 * so it can never resolve to another restaurant's menu item or category —
 * tenant isolation is already guaranteed by the outer `Invoice` `$match`.
 */
export async function aggregateCategoryRevenue(
  restaurantId: string,
  from: Date,
  to: Date,
  limit?: number,
): Promise<CategoryRevenue[]> {
  const pipeline: PipelineStage[] = [
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        status: "issued",
        createdAt: { $gte: from, $lte: to },
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "menuitems",
        localField: "items.menuItemId",
        foreignField: "_id",
        as: "menuItem",
      },
    },
    { $unwind: "$menuItem" },
    {
      $group: {
        _id: "$menuItem.categoryId",
        qtySold: { $sum: "$items.qty" },
        revenue: { $sum: { $multiply: ["$items.qty", "$items.priceSnapshot"] } },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    {
      $project: {
        _id: 0,
        categoryId: "$_id",
        name: "$category.name",
        qtySold: 1,
        revenue: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ];

  if (limit) pipeline.push({ $limit: limit });

  const results = await Invoice.aggregate<{
    categoryId: Types.ObjectId;
    name: string;
    qtySold: number;
    revenue: number;
  }>(pipeline);

  return results.map((r) => ({
    categoryId: r.categoryId.toString(),
    name: r.name,
    qtySold: r.qtySold,
    revenue: r.revenue,
  }));
}

export interface HourlyRevenue {
  hour: number;
  revenue: number;
}

/** Revenue by hour-of-day (0-23), used only for single-day report ranges
 * (PRD §3.12 "Revenue by hour"). `$hour` evaluates in the database's own
 * time zone (UTC by default) — same single-timezone-deployment caveat as
 * `resolveDateRange`. */
export async function aggregateRevenueByHour(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<HourlyRevenue[]> {
  const results = await Invoice.aggregate<{ _id: number; revenue: number }>([
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        status: "issued",
        createdAt: { $gte: from, $lte: to },
      },
    },
    { $group: { _id: { $hour: "$createdAt" }, revenue: { $sum: "$total" } } },
    { $sort: { _id: 1 } },
  ]);

  const byHour = new Map(results.map((r) => [r._id, r.revenue]));
  return Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: byHour.get(hour) ?? 0 }));
}

export interface DailyRevenue {
  /** `YYYY-MM-DD`. */
  date: string;
  grossRevenue: number;
}

/** Daily gross-revenue series for the Dashboard's weekly trend chart (PRD
 * §3.2). Zero-fills days with no issued invoices so the chart never has a
 * gap. */
export async function aggregateDailyRevenue(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<DailyRevenue[]> {
  const results = await Invoice.aggregate<{ _id: string; grossRevenue: number }>([
    {
      $match: {
        restaurantId: new Types.ObjectId(restaurantId),
        status: "issued",
        createdAt: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        grossRevenue: { $sum: "$subtotal" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byDate = new Map(results.map((r) => [r._id, r.grossRevenue]));

  const days: DailyRevenue[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, grossRevenue: byDate.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export interface StaffPerformanceEntry {
  staffId: string;
  name: string;
  role: UserRole;
  ordersCreated: number;
  ordersServed: number;
  /** Average minutes from order creation to order closed (payment
   * settled), across this staff member's served+closed orders in range.
   * `null` when they have none in range. */
  avgTurnaroundMinutes: number | null;
}

/**
 * Staff performance (PRD §3.12, Owner/Manager only — enforced at the route
 * level, see `report.routes.ts`). "Orders handled" is split into two
 * counts per the PRD's own wording ("by createdByStaffId/servedByStaffId"):
 * orders a staff member created, and orders they served through to close.
 * Turnaround uses `Order.updatedAt` as the "closed at" timestamp — there is
 * no separate `closedAt` field on the model, and once an order reaches
 * `closed` nothing in this codebase updates it again, so `updatedAt` is an
 * accurate proxy without a schema change.
 */
export async function aggregateStaffPerformance(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<StaffPerformanceEntry[]> {
  const restaurantObjectId = new Types.ObjectId(restaurantId);

  const [facetResult] = await Order.aggregate<{
    created: { _id: Types.ObjectId; ordersCreated: number }[];
    servedClosed: { _id: Types.ObjectId; ordersServed: number; totalTurnaroundMs: number }[];
  }>([
    { $match: { restaurantId: restaurantObjectId, createdAt: { $gte: from, $lte: to } } },
    {
      $facet: {
        created: [{ $group: { _id: "$createdByStaffId", ordersCreated: { $sum: 1 } } }],
        servedClosed: [
          { $match: { status: "closed", servedByStaffId: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: "$servedByStaffId",
              ordersServed: { $sum: 1 },
              totalTurnaroundMs: { $sum: { $subtract: ["$updatedAt", "$createdAt"] } },
            },
          },
        ],
      },
    },
  ]);

  const created = facetResult?.created ?? [];
  const servedClosed = facetResult?.servedClosed ?? [];

  const byStaff = new Map<
    string,
    { ordersCreated: number; ordersServed: number; totalTurnaroundMs: number }
  >();
  for (const entry of created) {
    byStaff.set(entry._id.toString(), {
      ordersCreated: entry.ordersCreated,
      ordersServed: 0,
      totalTurnaroundMs: 0,
    });
  }
  for (const entry of servedClosed) {
    const id = entry._id.toString();
    const existing = byStaff.get(id) ?? { ordersCreated: 0, ordersServed: 0, totalTurnaroundMs: 0 };
    existing.ordersServed = entry.ordersServed;
    existing.totalTurnaroundMs = entry.totalTurnaroundMs;
    byStaff.set(id, existing);
  }

  if (byStaff.size === 0) return [];

  const staffIds = Array.from(byStaff.keys());
  const staffDocs = await User.find({ restaurantId, _id: { $in: staffIds } }).select("name role");
  const staffById = new Map(staffDocs.map((doc) => [doc._id.toString(), doc]));

  return staffIds
    .map((staffId) => {
      const stats = byStaff.get(staffId)!;
      const staff = staffById.get(staffId);
      return {
        staffId,
        name: staff?.name ?? "Unknown staff",
        role: staff?.role ?? ("server" as UserRole),
        ordersCreated: stats.ordersCreated,
        ordersServed: stats.ordersServed,
        avgTurnaroundMinutes:
          stats.ordersServed > 0
            ? Math.round(stats.totalTurnaroundMs / stats.ordersServed / 60000)
            : null,
      };
    })
    .sort((a, b) => b.ordersCreated - a.ordersCreated);
}
