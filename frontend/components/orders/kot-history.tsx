"use client";

import type { OrderItem, OrderItemStatus } from "@/lib/orders/types";

const STATUS_LABEL: Record<OrderItemStatus, string> = {
  pending: "New",
  sent: "Preparing",
  ready: "Ready",
  served: "Served",
};

const STATUS_DOT: Record<OrderItemStatus, string> = {
  pending: "bg-text-muted",
  sent: "bg-info",
  ready: "bg-warning",
  served: "bg-success",
};

const STATUS_TEXT: Record<OrderItemStatus, string> = {
  pending: "text-text-muted",
  sent: "text-info",
  ready: "text-warning",
  served: "text-success",
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
 * "Already sent to the kitchen" list — grouped by KOT batch (one group per
 * `send-to-kitchen` call), each item showing a colored status dot and its
 * current stage (Preparing/Ready/Served). Lives inside `CartRail`'s
 * "In Kitchen" section on the Active Order screen — deliberately compact
 * (no per-batch card chrome) since it shares a narrow rail with the
 * pending-items cart below it.
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
    <div className="flex flex-col gap-3">
      {batches.map((batch, index) => (
        <div key={batch.sentAt ?? index} className="flex flex-col gap-2">
          {batch.sentAt && (
            <p className="text-small text-text-muted">
              Sent{" "}
              {new Date(batch.sentAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {batch.items.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.itemStatus]}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
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
                </div>
                <span
                  className={`shrink-0 text-small font-medium ${STATUS_TEXT[item.itemStatus]}`}
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
