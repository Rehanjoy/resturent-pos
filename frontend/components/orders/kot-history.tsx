"use client";

import { formatMoney } from "@/lib/format";
import type { OrderItem, OrderItemStatus } from "@/lib/orders/types";

const STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending: "New",
  sent: "In Kitchen",
  ready: "Ready",
  served: "Served",
};

const STATUS_STYLES: Record<OrderItemStatus, string> = {
  pending: "border-border text-text-muted",
  sent: "border-info text-info",
  ready: "border-warning text-warning",
  served: "border-success text-success",
};

interface Batch {
  sentAt: string | null;
  items: OrderItem[];
}

/**
 * Groups already-sent items by the batch they were sent to the kitchen in.
 * There's no direct "list this order's KOTs" endpoint (the KDS ticket
 * board is restaurant-wide, not order-scoped) — but every item sent in the
 * same `POST /send-kitchen` call shares the exact same `sentAt` timestamp
 * (one `Date` instance per Kot, per `order.service.ts`), so grouping by
 * that timestamp reconstructs the same "one card per KOT" grouping the
 * KDS board shows, without adding a new endpoint.
 */
function groupBySentBatch(items: OrderItem[]): Batch[] {
  const batches = new Map<string, OrderItem[]>();
  for (const item of items) {
    if (!item.sentAt) continue;
    const key = item.sentAt;
    const existing = batches.get(key);
    if (existing) existing.push(item);
    else batches.set(key, [item]);
  }
  return Array.from(batches.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sentAt, batchItems]) => ({ sentAt, items: batchItems }));
}

/**
 * Active Order screen's "already sent" panel — already-sent items grouped
 * by KOT batch, each with a per-item status pill (sent/ready/served).
 */
export function KotHistory({ items }: { items: OrderItem[] }) {
  const sentItems = items.filter((item) => item.itemStatus !== "pending");
  const batches = groupBySentBatch(sentItems);

  if (batches.length === 0) {
    return (
      <p className="text-small text-text-muted">
        Nothing sent to the kitchen yet — add items and send the first batch.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {batches.map((batch, index) => (
        <div key={batch.sentAt ?? index} className="rounded-lg border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-heading text-h4 font-semibold text-text">Batch {index + 1}</h3>
            {batch.sentAt && (
              <span className="text-small text-text-muted">
                Sent {new Date(batch.sentAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {batch.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body text-text">
                    {item.qty} × {item.nameSnapshot}
                  </p>
                  <p className="text-small text-text-muted">
                    {[
                      item.spiceLevel && item.spiceLevel !== "none" ? item.spiceLevel : null,
                      ...item.addOns,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {item.notes && <p className="text-small italic text-text-muted">{item.notes}</p>}
                  <p className="text-numeric text-text-muted">{formatMoney(item.priceSnapshot)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-small font-medium ${STATUS_STYLES[item.itemStatus]}`}
                >
                  {STATUS_LABEL[item.itemStatus]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
