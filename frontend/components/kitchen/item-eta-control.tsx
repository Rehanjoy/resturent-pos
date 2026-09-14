"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { seatingAdminApi } from "@/lib/tables/seating-admin-api";

export function ItemEtaControl({ orderId, itemId, name, estimatedReadyAt }: { orderId: string; itemId: string; name: string; estimatedReadyAt?: string }) {
  const [editing, setEditing] = useState(false);
  const [minutes, setMinutes] = useState(15);
  const cache = useQueryClient();
  const save = useMutation({ mutationFn: () => seatingAdminApi.eta(orderId, itemId, minutes), onSuccess: () => { setEditing(false); cache.invalidateQueries({ queryKey: ["kitchenTickets"] }); cache.invalidateQueries({ queryKey: ["order", orderId] }); } });
  return <div className="mt-2 space-y-2 text-xs">
    {!editing && <button onClick={() => setEditing(true)} className="min-h-9 text-primary underline">{estimatedReadyAt ? `Ready by ${new Date(estimatedReadyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Update` : "Set preparation time"}</button>}
    {editing && <form className="flex flex-wrap items-center gap-2" onSubmit={event => { event.preventDefault(); save.mutate(); }}><label>Minutes from now<input aria-label={`Minutes remaining for ${name}`} type="number" required min="1" max="240" value={minutes} onChange={event => setMinutes(Number(event.target.value))} className="ml-2 w-20 rounded-lg border border-border px-2" /></label><button disabled={save.isPending} className="min-h-11 rounded-lg bg-primary px-3 text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setEditing(false)} className="min-h-11 px-2">Cancel</button></form>}
    {save.isError && <p role="alert" className="text-error">{save.error.message}</p>}
  </div>;
}
