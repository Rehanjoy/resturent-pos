"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { seatingAdminApi, type DiningPolicy } from "@/lib/tables/seating-admin-api";

function PolicyFields({ initial }: { initial: DiningPolicy }) {
  const [values, setValues] = useState(initial);
  const queryClient = useQueryClient();
  const save = useMutation({ mutationFn: seatingAdminApi.policy, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dining-policy"] }) });
  const fields: { key: keyof DiningPolicy; label: string; max: number }[] = [
    { key: "holdMinutes", label: "Customer seat hold (minutes)", max: 30 },
    { key: "freeCancellationMinutes", label: "Free cancellation until (minutes)", max: 60 },
    { key: "partialCancellationMinutes", label: "Full charge starts at (minutes)", max: 120 },
    { key: "partialChargePercent", label: "Charge between deadlines (%)", max: 99 },
    { key: "defaultPrepMinutes", label: "Default preparation time (minutes)", max: 240 },
  ];
  return <form onSubmit={event => { event.preventDefault(); save.mutate(values); }} className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="space-y-1 text-sm font-medium">
      <span>{field.label}</span><input type="number" min={field.key === "freeCancellationMinutes" ? 0 : 1} max={field.max} step="1" required value={values[field.key]} onChange={event => setValues({ ...values, [field.key]: Number(event.target.value) })} className="w-full rounded-xl border border-border px-3 py-2" />
    </label>)}</div>
    <div className="rounded-xl bg-background p-4 text-sm leading-6"><strong>Customer sees:</strong> Free before {values.freeCancellationMinutes} min · {values.partialChargePercent}% from {values.freeCancellationMinutes} to {values.partialCancellationMinutes} min · 100% at {values.partialCancellationMinutes} min and after. Pay at the counter.<p className="mt-1 text-text-muted">Policies are saved with each order. Changes apply to future orders. Staff bookings stay occupied until manually released.</p></div>
    {values.partialCancellationMinutes <= values.freeCancellationMinutes && <p role="alert" className="text-sm text-error">Full-charge deadline must be after the free cancellation deadline.</p>}
    {save.isError && <p role="alert" className="text-sm text-error">{save.error.message}</p>}
    {save.isSuccess && <p role="status" className="text-sm text-success">Dining policy saved.</p>}
    <button disabled={save.isPending || values.partialCancellationMinutes <= values.freeCancellationMinutes} className="rounded-full bg-primary px-6 py-3 font-semibold text-white disabled:opacity-50">{save.isPending ? "Saving…" : "Save dining policy"}</button>
  </form>;
}
export function DiningPolicyForm() {
  const query = useQuery({ queryKey: ["dining-policy"], queryFn: seatingAdminApi.get });
  return <section className="space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-6"><div><h2 className="font-heading text-lg font-semibold">Seating & cancellation</h2><p className="mt-1 text-sm text-text-muted">Clear deadlines, no surprises for your guests.</p></div>
    {query.isLoading && <p>Loading dining policy…</p>}{query.isError && <p role="alert" className="text-error">{query.error.message}</p>}
    {query.data && <PolicyFields initial={query.data.policy} />}
  </section>;
}
