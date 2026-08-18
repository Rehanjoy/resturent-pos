import { formatMoney } from "@/lib/format";
import type { TopDishesReport } from "@/lib/reports/types";

function DishTable({ title, dishes }: { title: string; dishes: TopDishesReport["topDishes"] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="font-heading text-h4 font-semibold text-text">{title}</h3>
      {dishes.length === 0 ? (
        <p className="mt-2 text-small text-text-muted">No sales in this range yet.</p>
      ) : (
        <table className="mt-3 w-full text-small">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="py-1 font-medium">Dish</th>
              <th className="py-1 text-right font-medium">Qty Sold</th>
              <th className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((dish) => (
              <tr key={dish.menuItemId} className="border-b border-border last:border-0">
                <td className="py-1.5 text-text">{dish.name}</td>
                <td className="py-1.5 text-right tabular-nums text-text">{dish.qtySold}</td>
                <td className="py-1.5 text-right tabular-nums text-text-muted">
                  {formatMoney(dish.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TopDishesTab({ report }: { report: TopDishesReport }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <DishTable title="Top-Performing Dishes" dishes={report.topDishes} />
      <DishTable title="Slow-Moving Items" dishes={report.slowMovingDishes} />
    </div>
  );
}
