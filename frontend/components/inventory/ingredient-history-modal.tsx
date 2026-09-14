"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { costingApi } from "@/lib/costing/api";
import { formatMoney } from "@/lib/format";
import type { InventoryItem } from "@/lib/inventory/types";

export function IngredientHistoryModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["ingredient-cost-history", item.id],
    queryFn: () => costingApi.ingredientHistory(item.id),
  });

  return <Modal title={`${item.name} · rate history`} onClose={onClose}>
    <div className="space-y-5">
      <div className="rounded-2xl bg-background p-4">
        <p className="text-xs text-text-muted">Current purchase rate</p>
        <strong className="mt-1 block text-2xl tabular-nums">{formatMoney(item.costPerUnit)} / {item.unit}</strong>
        <p className="mt-2 text-xs text-text-muted">Editing this rate recalculates every linked dish cost. It does not rewrite old invoices.</p>
      </div>
      {query.isLoading && <p role="status" className="text-sm text-text-muted">Loading rate changes…</p>}
      {query.isError && <div role="alert"><p className="text-sm text-error">{query.error.message}</p><button onClick={() => query.refetch()} className="mt-2 min-h-11 rounded-full border border-border px-4 text-sm">Retry</button></div>}
      {query.data && <>
        <section><h3 className="text-sm font-semibold">Linked dishes ({query.data.linkedDishes.length})</h3>{query.data.linkedDishes.length ? <div className="mt-2 flex flex-wrap gap-2">{query.data.linkedDishes.map(dish => <span key={dish.id} className="rounded-full bg-primary/10 px-3 py-2 text-xs text-primary">{dish.name}</span>)}</div> : <p className="mt-2 text-sm text-text-muted">This ingredient is not linked to a recipe yet.</p>}</section>
        <section><h3 className="text-sm font-semibold">Recorded purchase-rate changes</h3>{query.data.history.length ? <ol className="mt-2 space-y-2">{query.data.history.map((entry, index) => <li key={`${entry.changedAt}-${index}`} className="rounded-xl border border-border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span><span className="text-text-muted">{formatMoney(entry.oldCostPerUnit)}</span> → <strong>{formatMoney(entry.costPerUnit)} / {item.unit}</strong></span><time className="text-xs text-text-muted" dateTime={entry.changedAt}>{new Date(entry.changedAt).toLocaleString("en-IN")}</time></div></li>)}</ol> : <p className="mt-2 text-sm text-text-muted">No rate change recorded yet. The first edit will appear here.</p>}</section>
      </>}
    </div>
  </Modal>;
}
