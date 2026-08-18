import { formatMoney } from "@/lib/format";
import type { OrderItem } from "@/lib/orders/types";

/**
 * Read-only itemized list of everything on the order being billed — no qty
 * stepper/remove here (unlike `CartRail`), since a served order's items are
 * locked by the time billing starts (`order.service.ts` only lets items be
 * edited in earlier statuses).
 */
export function BillItems({ items }: { items: OrderItem[] }) {
  if (items.length === 0) {
    return <p className="text-small text-text-muted">This order has no items.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface shadow-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="flex-1">
            <p className="text-body font-medium text-text">
              {item.qty} &times; {item.nameSnapshot}
            </p>
            <p className="text-small text-text-muted">
              {[item.spiceLevel && item.spiceLevel !== "none" ? item.spiceLevel : null, ...item.addOns]
                .filter(Boolean)
                .join(", ")}
            </p>
            {item.notes && <p className="text-small italic text-text-muted">{item.notes}</p>}
          </div>
          <p className="text-numeric text-text">{formatMoney(item.priceSnapshot * item.qty)}</p>
        </li>
      ))}
    </ul>
  );
}
