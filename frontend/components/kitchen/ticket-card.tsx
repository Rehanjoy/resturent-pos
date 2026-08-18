"use client";

import { useEffect, useState } from "react";
import type { Kot } from "@/lib/orders/types";

// Configurable SLA per PRD §3.4 example ("e.g. 15 min"). Below the warning
// threshold reads as on-time (success/green); between the two thresholds
// is "getting late" (warning/yellow); past the SLA is overdue
// (error/red). Kept as local constants rather than a settings lookup — a
// real per-restaurant configurable SLA belongs in the Settings module
// (PRD §3.14), out of scope for this build part.
const SLA_MINUTES = 15;
const WARNING_AT_MINUTES = 10;

type UrgencyTier = "success" | "warning" | "error";

function urgencyTierOf(elapsedMinutes: number): UrgencyTier {
  if (elapsedMinutes >= SLA_MINUTES) return "error";
  if (elapsedMinutes >= WARNING_AT_MINUTES) return "warning";
  return "success";
}

const TIER_BORDER: Record<UrgencyTier, string> = {
  success: "border-success",
  warning: "border-warning",
  error: "border-error",
};

// Elapsed-time readout rendered as a colored pill (chip) rather than plain
// colored text — same `bg-{tone}/10 text-{tone}` chip language already
// used by `StatCard`/`LiveOpsTiles` elsewhere in the redesign, applied
// here to the exact same success/warning/error SLA tiers the ticket border
// already used (no change to the tier thresholds/logic, presentation
// only).
const TIER_CHIP: Record<UrgencyTier, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

function formatElapsed(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  if (wholeMinutes < 60) return `${wholeMinutes}m`;
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;
  return `${hours}h ${remainder}m`;
}

/** Recomputes elapsed time every 30s on its own timer — this is time-based
 * urgency, not data-based, so it can't just wait for the next server
 * update/refetch to re-render (PRD §3.4 color escalation). */
function useElapsedMinutes(sentAt: string): number {
  const [elapsedMinutes, setElapsedMinutes] = useState(() => (Date.now() - new Date(sentAt).getTime()) / 60000);

  useEffect(() => {
    const tick = () => setElapsedMinutes((Date.now() - new Date(sentAt).getTime()) / 60000);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [sentAt]);

  return elapsedMinutes;
}

const ITEM_STATUS_LABEL: Record<Kot["items"][number]["itemStatus"], string> = {
  pending: "New",
  sent: "Preparing",
  ready: "Ready",
  served: "Served",
};

// Same info/warning/success semantic set `kot-history.tsx` uses for these
// exact statuses on the Order screen — kept identical here so a "Ready"
// item reads the same color on both screens.
const ITEM_STATUS_DOT: Record<Kot["items"][number]["itemStatus"], string> = {
  pending: "bg-text-muted",
  sent: "bg-info",
  ready: "bg-warning",
  served: "bg-success",
};

export function TicketCard({
  kot,
  tableName,
  canManage,
  onMarkItemReady,
  onMarkAllReady,
  isMarkingItem,
  isMarkingAll,
}: {
  kot: Kot;
  tableName: string;
  canManage: boolean;
  onMarkItemReady: (orderItemId: string) => void;
  onMarkAllReady: () => void;
  isMarkingItem: boolean;
  isMarkingAll: boolean;
}) {
  const elapsedMinutes = useElapsedMinutes(kot.sentAt);
  const tier = urgencyTierOf(elapsedMinutes);
  const isFullyReady = !!kot.allReadyAt;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-surface p-4 shadow-sm ${TIER_BORDER[tier]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-h4 font-semibold text-text">{tableName}</h3>
          <p className="text-small text-text-muted">
            Sent {new Date(kot.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-small font-semibold tabular-nums ${TIER_CHIP[tier]}`}
        >
          {formatElapsed(elapsedMinutes)}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {kot.items.map((item) => (
          <li key={item.orderItemId} className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span
                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${ITEM_STATUS_DOT[item.itemStatus]}`}
                aria-hidden
              />
              <div>
                <p className="text-body text-text">
                  {item.qty} × {item.nameSnapshot}
                </p>
                <p className="text-small text-text-muted">
                  {[item.spiceLevel && item.spiceLevel !== "none" ? item.spiceLevel : null, ...item.addOns]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {item.notes && <p className="text-small italic text-text-muted">{item.notes}</p>}
              </div>
            </div>

            {canManage && item.itemStatus !== "ready" && item.itemStatus !== "served" ? (
              <button
                type="button"
                disabled={isMarkingItem}
                onClick={() => onMarkItemReady(item.orderItemId)}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-small text-text hover:border-success hover:text-success disabled:opacity-60"
              >
                Mark Ready
              </button>
            ) : (
              <span className="shrink-0 text-small font-medium text-text-muted">
                {ITEM_STATUS_LABEL[item.itemStatus]}
              </span>
            )}
          </li>
        ))}
      </ul>

      {canManage && !isFullyReady && (
        <button
          type="button"
          disabled={isMarkingAll}
          onClick={onMarkAllReady}
          className="mt-1 w-full rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
        >
          {isMarkingAll ? "Marking…" : "Mark All Ready"}
        </button>
      )}

      {isFullyReady && (
        <p className="text-small font-medium text-success">
          All items ready — waiting to be served.
        </p>
      )}
    </div>
  );
}
