"use client";
import { useEffect, useRef, useState } from "react";
import type { DiningOrder } from "@/lib/dining/types";
export function OrderUpdates({ order }: { order: DiningOrder }) {
  const signature = `${order.status}|${order.items.map(item => `${item.id}:${item.itemStatus}:${item.estimatedReadyAt ?? ""}`).join("|")}`; const previous = useRef(signature); const [announcement, setAnnouncement] = useState("");
  useEffect(() => { if (previous.current === signature) return; previous.current = signature; const ready = order.items.filter(item => item.itemStatus === "ready").map(item => item.nameSnapshot); const next = ready.length ? `${ready.join(", ")} ${ready.length === 1 ? "is" : "are"} ready.` : order.status === "closed" ? "Payment complete. Thank you." : "Your order has been updated by the kitchen."; setAnnouncement(next); document.title = `${next} · Saffron`; const timer = window.setTimeout(() => setAnnouncement(""), 7000); return () => window.clearTimeout(timer); }, [order, signature]);
  return <div aria-live="polite" aria-atomic="true">{announcement && <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-2xl bg-text px-5 py-4 text-sm font-semibold text-white shadow-xl">{announcement}</div>}</div>;
}
