import { formatMoney } from "@/lib/format";
import type { CategoryRevenue, TopDish } from "@/lib/dashboard/types";

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
      {rank}
    </span>
  );
}

export function TopDishesList({
  dishes,
  categories,
}: {
  dishes: TopDish[];
  categories: CategoryRevenue[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="font-heading text-h4 font-semibold text-text">Top Dishes Today</h3>
        {dishes.length === 0 ? (
          <p className="mt-3 text-small text-text-muted">No sales yet today.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {dishes.map((dish, index) => (
              <li key={dish.menuItemId} className="flex items-center gap-3">
                <RankBadge rank={index + 1} />
                <span className="flex-1 truncate text-small text-text">
                  {dish.name} <span className="text-text-muted">×{dish.qtySold}</span>
                </span>
                <span className="tabular-nums text-small font-medium text-text-muted">
                  {formatMoney(dish.revenue)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="font-heading text-h4 font-semibold text-text">Top Categories Today</h3>
        {categories.length === 0 ? (
          <p className="mt-3 text-small text-text-muted">No sales yet today.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {categories.map((category, index) => (
              <li key={category.categoryId} className="flex items-center gap-3">
                <RankBadge rank={index + 1} />
                <span className="flex-1 truncate text-small text-text">
                  {category.name} <span className="text-text-muted">×{category.qtySold}</span>
                </span>
                <span className="tabular-nums text-small font-medium text-text-muted">
                  {formatMoney(category.revenue)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
