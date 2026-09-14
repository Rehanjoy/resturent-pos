"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { costingApi } from "@/lib/costing/api";
import type { CostSettings, DishCost } from "@/lib/costing/types";
import { Modal } from "@/components/ui/modal";

export const costInput = "mt-1 min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-text outline-none focus:ring-2 focus:ring-primary/30";
const submitClass = "min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-white disabled:opacity-50";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function numeric(form: FormData, key: string) { return Number(form.get(key)); }

function NumberField({ name, label, value, percent = false, integer = false, min = 0, max }: { name: string; label: string; value: number; percent?: boolean; integer?: boolean; min?: number; max?: number }) {
  return <label className="block text-sm font-medium">{label}<input name={name} type="number" min={min} max={max ?? (percent ? 100 : 100000000)} step={integer ? 1 : "0.01"} required defaultValue={value} className={costInput} /></label>;
}

export function CostSettingsForm({ settings, onClose }: { settings: CostSettings; onClose: () => void }) {
  const cache = useQueryClient();
  const [mode, setMode] = useState(settings.overheadMode);
  const mutation = useMutation({ mutationFn: costingApi.settings, onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["dish-costing"] }); onClose(); } });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    mutation.mutate({ targetFoodCostPercent: numeric(data, "food"), targetMarginPercent: numeric(data, "margin"), wastagePercent: numeric(data, "waste"), overheadMode: mode, overheadPercent: mode === "percentage" ? numeric(data, "overhead") : settings.overheadPercent, monthlyOverheadPaise: mode === "monthly" ? Math.round(numeric(data, "monthly") * 100) : settings.monthlyOverheadPaise, monthlyPortions: mode === "monthly" ? numeric(data, "portions") : settings.monthlyPortions });
  }
  return <Modal title="Costing rules" onClose={onClose}><form onSubmit={submit} className="space-y-5">
    <p className="text-sm text-text-muted">Set your own targets. These rules estimate dish economics; they do not change menu prices or deduct stock.</p>
    <div className="grid grid-cols-2 gap-3"><NumberField name="food" label="Target food cost %" value={settings.targetFoodCostPercent} percent min={1} /><NumberField name="margin" label="Target margin %" value={settings.targetMarginPercent} percent max={99} /></div>
    <NumberField name="waste" label="Default wastage allowance %" value={settings.wastagePercent} percent />
    <label className="block text-sm font-medium">Allocate overhead<select value={mode} onChange={event => setMode(event.target.value as CostSettings["overheadMode"])} className={costInput}><option value="percentage">Percentage of ingredient cost</option><option value="monthly">Monthly budget ÷ expected portions</option></select></label>
    {mode === "percentage" ? <NumberField name="overhead" label="Overhead % of ingredient cost" value={settings.overheadPercent} percent max={1000} /> : <div className="grid grid-cols-2 gap-3"><NumberField name="monthly" label="Monthly overhead (₹)" value={settings.monthlyOverheadPaise / 100} /><NumberField name="portions" label="Monthly portions" value={settings.monthlyPortions} min={1} integer /></div>}
    <p className="rounded-xl bg-background p-3 text-xs text-text-muted">Include rent, shared staff, fuel and utilities here. If a cost is already included here or in the recipe, do not add it again as a per-dish extra. Wastage is a pricing allowance; actual waste stays in the stock ledger.</p>
    {mutation.isError && <p role="alert" className="text-sm text-error">{mutation.error.message}</p>}
    <button disabled={mutation.isPending} className={submitClass}>{mutation.isPending ? "Saving…" : "Save costing rules"}</button>
  </form></Modal>;
}

export function DishCostForm({ dish, onClose }: { dish: DishCost; onClose: () => void }) {
  const cache = useQueryClient();
  const [inherit, setInherit] = useState(dish.config.wastagePercent === null);
  const [season, setSeason] = useState(dish.config.seasonalMonths);
  const mutation = useMutation({ mutationFn: (input: Parameters<typeof costingApi.configure>[1]) => costingApi.configure(dish.id, input), onSuccess: async () => { await cache.invalidateQueries({ queryKey: ["dish-costing"] }); onClose(); } });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    mutation.mutate({ packagingPaise: Math.round(numeric(form, "packaging") * 100), laborPaise: Math.round(numeric(form, "labor") * 100), utilitiesPaise: Math.round(numeric(form, "utilities") * 100), otherPaise: Math.round(numeric(form, "other") * 100), wastagePercent: inherit ? null : numeric(form, "waste"), seasonalMonths: season });
  }
  return <Modal title={`${dish.name} · cost setup`} onClose={onClose}><form onSubmit={submit} className="space-y-5">
    <p className="text-sm text-text-muted">Additional cost per sold portion. Leave zero when already covered by the recipe or shared overhead.</p>
    <div className="grid grid-cols-2 gap-3"><NumberField name="packaging" label="Packaging (₹)" value={dish.config.packagingPaise / 100} /><NumberField name="labor" label="Direct labour (₹)" value={dish.config.laborPaise / 100} /><NumberField name="utilities" label="Fuel / utilities (₹)" value={dish.config.utilitiesPaise / 100} /><NumberField name="other" label="Other cost (₹)" value={dish.config.otherPaise / 100} /></div>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={inherit} onChange={event => setInherit(event.target.checked)} className="h-5 w-5 accent-primary" />Use default wastage allowance</label>
    {!inherit && <NumberField name="waste" label="Dish wastage allowance %" value={dish.config.wastagePercent ?? 0} percent />}
    <fieldset><legend className="text-sm font-semibold">Preferred seasonal months</legend><p className="mb-3 mt-1 text-xs text-text-muted">Based on your local knowledge. Leave empty for year-round. This is not a weather forecast.</p><div className="grid grid-cols-4 gap-2">{months.map((month, index) => <button key={month} type="button" aria-pressed={season.includes(index + 1)} onClick={() => setSeason(current => current.includes(index + 1) ? current.filter(value => value !== index + 1) : [...current, index + 1].sort((a, b) => a - b))} className={`min-h-11 rounded-xl border text-sm ${season.includes(index + 1) ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{month}</button>)}</div></fieldset>
    {mutation.isError && <p role="alert" className="text-sm text-error">{mutation.error.message}</p>}
    <button disabled={mutation.isPending} className={submitClass}>{mutation.isPending ? "Saving…" : "Save dish cost setup"}</button>
  </form></Modal>;
}
