"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { DiningOrder } from "@/lib/dining/types";

/**
 * Announces kitchen status changes (an item going "ready", or the order
 * closing) as they happen. Same trigger logic as before — a signature diff
 * over item statuses/ETAs so this only fires on a real change, not every
 * poll — just rendered via `sonner`'s toast stack (which manages its own
 * `aria-live` region) instead of a hand-rolled fixed banner + timeout.
 */
export function OrderUpdates({ order }: { order: DiningOrder }) {
  const signature = `${order.status}|${order.items.map((item) => `${item.id}:${item.itemStatus}:${item.estimatedReadyAt ?? ""}`).join("|")}`;
  const previous = useRef(signature);

  useEffect(() => {
    if (previous.current === signature) return;
    previous.current = signature;
    const ready = order.items.filter((item) => item.itemStatus === "ready").map((item) => item.nameSnapshot);
    const next = ready.length
      ? `${ready.join(", ")} ${ready.length === 1 ? "is" : "are"} ready.`
      : order.status === "closed"
        ? "Payment complete. Thank you."
        : "Your order has been updated by the kitchen.";
    document.title = `${next} · Saffron`;
    toast(next, { duration: 7000 });
  }, [order, signature]);

  return null;
}
