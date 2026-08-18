import { formatMoney } from "@/lib/format";
import type { CategoryRevenue, TopDish } from "@/lib/dashboard/types";

export function TopDishesList({
  dishes,
  categories,
}: {
  dishes: TopDish[];
  categories: CategoryRevenue[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="font-heading text-h4 font-semibold text-text">Top Dishes Today</h3>
        {dishes.length === 0 ? (
          <p className="mt-2 text-small text-text-muted">No sales yet today.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {dishes.map((dish, index) => (
              <li key={dish.menuItemId} className="flex items-center justify-between text-small">
                <span className="text-text">
                  {index + 1}. {dish.name} <span className="text-text-muted">×{dish.qtySold}</span>
                </span>
                <span className="tabular-nums text-text-muted">{formatMoney(dish.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="font-heading text-h4 font-semibold text-text">Top Categories Today</h3>
        {categories.length === 0 ? (
          <p className="mt-2 text-small text-text-muted">No sales yet today.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {categories.map((category, index) => (
              <li key={category.categoryId} className="flex items-center justify-between text-small">
                <span className="text-text">
                  {index + 1}. {category.name} <span className="text-text-muted">×{category.qtySold}</span>
                </span>
                <span className="tabular-nums text-text-muted">{formatMoney(category.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
