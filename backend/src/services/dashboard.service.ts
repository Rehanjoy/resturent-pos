import { resolveDateRange } from "../utils/date-range";
import * as analytics from "./sales-analytics.service";
import { getLowStockSummary, type LowStockItemDto } from "./inventory-item.service";

export interface DashboardSummaryDto {
  salesSummary: analytics.SalesTotals;
  paymentModeBreakdown: analytics.PaymentModeAmount[];
  liveOps: analytics.LiveOps;
  topDishes: analytics.TopDish[];
  topCategories: analytics.CategoryRevenue[];
  weeklyTrend: analytics.DailyRevenue[];
  /** PRD §3.2 "Low-stock inventory alerts widget" — items at or below
   * their reorder threshold. */
  lowStockCount: number;
  lowStockItems: LowStockItemDto[];
}

const TOP_SELLERS_LIMIT = 5;
const TOP_SELLERS_CACHE_TTL_MS = 60_000;

interface TopSellersCacheEntry {
  expiresAt: number;
  dishes: analytics.TopDish[];
  categories: analytics.CategoryRevenue[];
}

/**
 * PRD §3.2 asks for the top-sellers widget to be "cached with 60s TTL", and
 * the PRD's own architecture section assumes Redis for this
 * (`00-prd-source.md` §5.3). No module in this codebase has introduced
 * Redis yet, and adding it as a new dependency just for one dashboard
 * widget isn't justified at MVP query volumes — this in-memory `Map` is a
 * deliberately trivial stand-in, keyed per restaurant.
 *
 * TODO(redis): once Redis is introduced elsewhere in this codebase (Socket.io
 * horizontal scaling and rate-limiting are the PRD's other stated Redis
 * uses), move this cache there so it's shared across horizontally-scaled
 * API instances instead of being per-process/per-instance as it is here.
 */
const topSellersCache = new Map<string, TopSellersCacheEntry>();

async function getCachedTopSellers(
  restaurantId: string,
  from: Date,
  to: Date,
): Promise<{ dishes: analytics.TopDish[]; categories: analytics.CategoryRevenue[] }> {
  const cached = topSellersCache.get(restaurantId);
  if (cached && cached.expiresAt > Date.now()) {
    return { dishes: cached.dishes, categories: cached.categories };
  }

  const [dishes, categories] = await Promise.all([
    analytics.aggregateTopDishes(restaurantId, from, to, TOP_SELLERS_LIMIT, "top"),
    analytics.aggregateCategoryRevenue(restaurantId, from, to, TOP_SELLERS_LIMIT),
  ]);

  topSellersCache.set(restaurantId, {
    expiresAt: Date.now() + TOP_SELLERS_CACHE_TTL_MS,
    dishes,
    categories,
  });

  return { dishes, categories };
}

/**
 * Assembles `GET /api/dashboard/summary` (PRD §3.2). Everything here is
 * scoped to "today" except the weekly trend (last 7 days) and the live
 * operations widget (current-moment, no date scope at all) — those two are
 * deliberately NOT behind the top-sellers cache above, since a stale table/
 * kitchen count would contradict "live operations widget" being live.
 *
 * Low-stock inventory alerts (PRD §3.2) — likewise never cached; a stale
 * "you're out of X" signal would be worse than no signal.
 */
export async function getDashboardSummary(restaurantId: string): Promise<DashboardSummaryDto> {
  const today = resolveDateRange("today");
  const last7Days = resolveDateRange("7d");

  const [salesSummary, paymentModeBreakdown, liveOps, topSellers, weeklyTrend, lowStock] =
    await Promise.all([
      analytics.aggregateSalesTotals(restaurantId, today.from, today.to),
      analytics.aggregatePaymentModeBreakdown(restaurantId, today.from, today.to),
      analytics.getLiveOps(restaurantId),
      getCachedTopSellers(restaurantId, today.from, today.to),
      analytics.aggregateDailyRevenue(restaurantId, last7Days.from, last7Days.to),
      getLowStockSummary(restaurantId),
    ]);

  return {
    salesSummary,
    paymentModeBreakdown,
    liveOps,
    topDishes: topSellers.dishes,
    topCategories: topSellers.categories,
    weeklyTrend,
    lowStockCount: lowStock.count,
    lowStockItems: lowStock.items,
  };
}
