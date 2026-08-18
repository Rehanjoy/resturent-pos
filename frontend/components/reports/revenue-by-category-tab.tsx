import { formatMoney } from "@/lib/format";
import type { CategoryRevenue } from "@/lib/dashboard/types";

export function RevenueByCategoryTab({ categories }: { categories: CategoryRevenue[] }) {
  if (categories.length === 0) {
    return <p className="text-small text-text-muted">No sales in this range yet.</p>;
  }

  const max = Math.max(...categories.map((c) => c.revenue));

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-sm">
      {categories.map((category) => (
        <div key={category.categoryId} className="flex items-center gap-3">
          <span className="w-32 truncate text-small text-text">{category.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-secondary"
              style={{ width: `${(category.revenue / max) * 100}%` }}
            />
          </div>
          <span className="w-24 text-right text-small tabular-nums text-text-muted">
            {formatMoney(category.revenue)}
          </span>
        </div>
      ))}
    </div>
  );
}
