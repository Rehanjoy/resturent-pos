import { formatMoney } from "@/lib/format";
import type { CategoryRevenue } from "@/lib/dashboard/types";

/**
 * Clean horizontal bar list — kept as plain CSS rather than a third
 * Recharts instance on this screen (the area chart above and the donut on
 * the Payment Mode tab already cover "real chart" for this page; a ranked
 * list reads better than a bar chart for 5-10 category rows anyway, and
 * this is one of the two acceptable treatments called out for this tab).
 */
export function RevenueByCategoryTab({ categories }: { categories: CategoryRevenue[] }) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-small text-text-muted shadow-sm">
        No sales in this range yet.
      </div>
    );
  }

  const max = Math.max(...categories.map((c) => c.revenue));
  const total = categories.reduce((sum, c) => sum + c.revenue, 0);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="font-heading text-h4 font-semibold text-text">Revenue by Category</h3>
      <div className="flex flex-col gap-3">
        {categories.map((category) => {
          const percent = total > 0 ? Math.round((category.revenue / total) * 100) : 0;
          return (
            <div key={category.categoryId} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-small text-text">{category.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max > 0 ? (category.revenue / max) * 100 : 0}%` }}
                />
              </div>
              <span className="w-10 text-right text-small tabular-nums text-text-muted">{percent}%</span>
              <span className="w-24 text-right text-small font-medium tabular-nums text-text">
                {formatMoney(category.revenue)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
