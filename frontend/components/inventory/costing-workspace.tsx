"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { costingApi } from "@/lib/costing/api";
import type { CostOverview, DishCost } from "@/lib/costing/types";
import { menuItemsApi } from "@/lib/menu/api";
import { formatMoney } from "@/lib/format";
import { CostSettingsForm, DishCostForm, costInput } from "./costing-forms";

const labels: Record<DishCost["status"], string> = { healthy: "On target", low_margin: "Below target", loss: "Estimated loss", incomplete: "Recipe / rate missing" };
const tones: Record<DishCost["status"], string> = { healthy: "bg-success/10 text-success", low_margin: "bg-warning/15 text-text", loss: "bg-error/10 text-error", incomplete: "bg-background text-text-muted" };
function percentage(value: number | null) { return value === null ? "—" : `${value.toFixed(1)}%`; }
function money(value: number | null) { return value === null ? "—" : formatMoney(value); }
function precise(value: number) { return value.toLocaleString("en-IN", { maximumFractionDigits: 6 }); }
function quantity(value: number, unit: string) {
  const normalized = unit.trim().toLowerCase();
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return `${precise(value * 1000)} g`;
  if (["l", "ltr", "litre", "liter", "litres", "liters"].includes(normalized)) return `${precise(value * 1000)} ml`;
  return `${precise(value)} ${unit}`;
}
function Badge({ dish }: { dish: DishCost }) { return <span className={`inline-block rounded-full px-3 py-1.5 text-xs font-semibold ${tones[dish.status]}`}>{labels[dish.status]}</span>; }

export function CostingWorkspace() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const overview = useQuery({ queryKey: ["dish-costing", days], queryFn: () => costingApi.overview(days), refetchOnWindowFocus: true });
  const canManage = user?.role === "owner" || user?.role === "manager";
  if (overview.isLoading) return <p role="status" className="rounded-2xl bg-surface p-8 text-text-muted">Calculating dish costs from your ingredient rates…</p>;
  if (overview.isError) return <div role="alert" className="rounded-2xl bg-surface p-6"><p className="text-error">{overview.error.message}</p><button onClick={() => overview.refetch()} className="mt-3 min-h-11 rounded-full border border-border px-5">Retry costing</button></div>;
  if (!overview.data) return null;
  const data = overview.data;
  const filtered = data.dishes.filter(dish => dish.name.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || dish.status === filter));
  const selected = filtered.find(dish => dish.id === selectedId) ?? filtered[0];
  return <section className="space-y-5" aria-label="Dish profitability">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Know what every plate costs</h2><p className="mt-1 max-w-2xl text-sm text-text-muted">Ingredient rates flow into every linked dish. Review costs, compare selling prices and check seasonal rate changes before making a decision.</p></div>{canManage && <button onClick={() => setSettingsOpen(true)} className="min-h-11 rounded-full border border-border bg-surface px-5 text-sm font-semibold">Costing rules</button>}</div>
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-4">{[
      ["Dishes costed", `${data.summary.totalDishes - data.summary.incompleteDishes} / ${data.summary.totalDishes}`],
      ["Estimated loss", String(data.summary.lossDishes)],
      ["Below your target", String(data.summary.lowMarginDishes)],
      ["Recipes / rates to complete", String(data.summary.incompleteDishes)],
    ].map(([label, value]) => <div key={label} className="bg-surface p-4"><p className="text-xs text-text-muted">{label}</p><strong className="mt-2 block text-2xl tabular-nums">{value}</strong></div>)}</div>
    <div className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-xs font-medium">Find a dish<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search dish name" className={costInput} /></label><label className="text-xs font-medium">Cost health<select value={filter} onChange={event => setFilter(event.target.value)} className={costInput}><option value="all">All dishes</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-medium">Sales window<select value={days} onChange={event => setDays(Number(event.target.value))} className={costInput}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
    <p className="text-xs text-text-muted">Menu prices and margins exclude tax. Targets: food cost ≤ {data.settings.targetFoodCostPercent}% and estimated margin ≥ {data.settings.targetMarginPercent}%.</p>
    {data.dishes.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center"><h3 className="font-semibold">Start with your menu and ingredients</h3><p className="mt-2 text-sm text-text-muted">Add dishes in Menu, then link their ingredients under Recipes & production. Cost sheets appear here automatically.</p></div> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(290px,.85fr)_minmax(0,1.5fr)]">
      <div className="space-y-2" aria-label="Dish cost list">{filtered.length === 0 && <p className="rounded-2xl bg-surface p-6 text-sm text-text-muted">No dishes match these filters.</p>}{filtered.map(dish => <button key={dish.id} onClick={() => setSelectedId(dish.id)} aria-pressed={selected?.id === dish.id} className={`w-full rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-primary ${selected?.id === dish.id ? "border-primary ring-1 ring-primary/20" : "border-border"}`}><div className="flex flex-wrap items-start justify-between gap-2"><strong>{dish.name}</strong><Badge dish={dish} /></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><span className="text-text-muted">Sell<strong className="mt-1 block text-sm text-text">{money(dish.sellingPricePaise)}</strong></span><span className="text-text-muted">Total cost<strong className="mt-1 block text-sm text-text">{dish.status === "incomplete" ? "Incomplete" : money(dish.totalCostPaise)}</strong></span><span className="text-text-muted">Est. margin<strong className={`mt-1 block text-sm ${dish.status === "loss" ? "text-error" : "text-text"}`}>{dish.status === "incomplete" ? "—" : percentage(dish.marginPercent)}</strong></span></div><p className="mt-3 text-xs text-text-muted">{dish.recentPortions} portions in {days} days{dish.inSeason === false ? " · Outside preferred season" : dish.inSeason === true ? " · In preferred season" : ""}</p></button>)}</div>
      {selected && <DishDetail key={`${selected.id}:${JSON.stringify(selected.config)}:${selected.sellingPricePaise}:${selected.ingredients.map(row => row.costPerUnit).join(",")}`} dish={selected} overview={data} canManage={canManage} />}
    </div>}
    <p className="rounded-xl bg-surface p-4 text-xs text-text-muted">{data.summary.estimateNote} Measured stock variance is a signal to review entries and portions; it does not prove theft.</p>
    {settingsOpen && <CostSettingsForm settings={data.settings} onClose={() => setSettingsOpen(false)} />}
  </section>;
}

function DishDetail({ dish, overview, canManage }: { dish: DishCost; overview: CostOverview; canManage: boolean }) {
  const [configOpen, setConfigOpen] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const ready = dish.status !== "incomplete";
  return <article className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{dish.name}</h3><p className="mt-1 text-xs text-text-muted">Standard batch: {dish.recipeYield} portions</p></div>{canManage && <button onClick={() => setConfigOpen(true)} className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold">Costs & season</button>}</div>
    <div className="mt-5 flex flex-wrap justify-between gap-4 rounded-2xl bg-background p-4"><div><p className="text-xs text-text-muted">Estimated contribution per portion</p><strong className={`mt-1 block text-3xl tabular-nums ${dish.profitPaise < 0 ? "text-error" : "text-text"}`}>{ready ? money(dish.profitPaise) : "Complete recipe"}</strong></div><div className="text-right"><p className="text-xs text-text-muted">Ingredient cost / selling price</p><strong className="mt-1 block text-xl">{ready ? percentage(dish.foodCostPercent) : "—"}</strong><Badge dish={dish} /></div></div>
    <h4 className="mb-3 mt-6 text-sm font-semibold">Every ingredient, accounted for</h4>
    <div className="overflow-x-auto"><table className="w-full min-w-[390px] text-left text-xs"><thead><tr className="border-b border-border text-text-muted"><th className="pb-3 pr-3 font-medium">Ingredient</th><th className="pb-3 pr-3 text-right font-medium">Per portion</th><th className="pb-3 pr-3 text-right font-medium">Rate</th><th className="pb-3 text-right font-medium">Cost</th></tr></thead><tbody>{dish.ingredients.map(row => <tr key={row.inventoryItemId} className="border-b border-border/60"><th className="py-3 pr-3 font-medium">{row.name}{row.missing && <span className="block text-error">Missing ingredient / rate</span>}<span className="mt-1 block font-normal text-text-muted">Batch: {quantity(row.quantityPerBatch, row.unit)}</span></th><td className="py-3 pr-3 text-right tabular-nums">{quantity(row.quantityPerPortion, row.unit)}</td><td className="py-3 pr-3 text-right tabular-nums">{money(row.costPerUnit)} / {row.unit}</td><td className="py-3 text-right tabular-nums">{money(row.costPaise)}</td></tr>)}</tbody></table></div>
    {dish.ingredients.length === 0 && <p className="py-4 text-sm text-text-muted">Link this dish to stock ingredients in Recipes & production.</p>}
    <p className="mt-2 text-[11px] text-text-muted">Line costs are displayed to the nearest paisa. Totals use unrounded recipe quantities, so displayed lines can differ by a paisa from the total.</p>
    <dl className="mt-5 space-y-3 text-sm">{[
      ["Ingredients", dish.foodCostPaise], ["Wastage allowance", dish.wastagePaise], ["Allocated overhead", dish.overheadPaise], ["Packaging, labour & other extras", dish.extraCostPaise],
    ].map(([label, amount]) => <div key={String(label)} className="flex justify-between gap-3"><dt className="text-text-muted">{label}</dt><dd className="tabular-nums">{money(Number(amount))}</dd></div>)}<div className="flex justify-between border-t border-border pt-3 font-semibold"><dt>Total estimated cost</dt><dd>{ready ? money(dish.totalCostPaise) : "Incomplete"}</dd></div></dl>
    <div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl border border-border p-3"><p className="text-xs text-text-muted">Break-even price</p><strong className="mt-1 block">{ready ? money(dish.breakEvenPaise) : "—"}</strong></div><div className="rounded-xl border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-text-muted">Price to meet both targets</p><strong className="mt-1 block">{ready ? money(dish.suggestedPricePaise) : "—"}</strong></div></div>
    <ul className="mt-4 space-y-2 text-xs text-text-muted">{dish.explanations.map((explanation, index) => <li key={index}>{explanation}</li>)}</ul>
    <p className="mt-4 text-xs text-text-muted">{dish.recentPortions} sold portions in {overview.summary.days} days. Current-cost contribution estimate: <strong className="text-text">{money(dish.recentEstimatedProfitPaise)}</strong>.</p>
    <button onClick={() => setScenarioOpen(value => !value)} aria-expanded={scenarioOpen} className="mt-5 min-h-12 w-full rounded-full bg-text px-4 text-sm font-semibold text-surface">{scenarioOpen ? "Close price comparison" : "Try a new selling price or seasonal rate"}</button>
    {scenarioOpen && <PriceScenario dish={dish} canManage={canManage} />}
    {configOpen && <DishCostForm dish={dish} onClose={() => setConfigOpen(false)} />}
  </article>;
}

function PriceScenario({ dish, canManage }: { dish: DishCost; canManage: boolean }) {
  const cache = useQueryClient();
  const scenario = useMutation({ mutationFn: costingApi.simulate });
  const [dirty, setDirty] = useState(false);
  const savePrice = useMutation({ mutationFn: (price: number) => menuItemsApi.update(dish.id, { price }), onSuccess: async () => { await Promise.all([cache.invalidateQueries({ queryKey: ["dish-costing"] }), cache.invalidateQueries({ queryKey: ["menu-items"] })]); } });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setDirty(false);
    scenario.mutate({ menuItemId: dish.id, sellingPricePaise: Math.round(Number(form.get("sell")) * 100), ingredientRates: dish.ingredients.filter(row => !row.missing).map(row => ({ inventoryItemId: row.inventoryItemId, costPerUnit: Math.round(Number(form.get(row.inventoryItemId)) * 100) })) });
  }
  const result = !dirty && !scenario.isPending ? scenario.data : undefined;
  return <div className="mt-4 border-t border-border pt-5"><form onSubmit={submit} onChange={() => setDirty(true)} className="space-y-4"><h4 className="font-semibold">What changes if rates move?</h4><p className="text-xs text-text-muted">Enter supplier quotes or expected seasonal rates. Previewing changes neither stock rates nor the live menu.</p><label className="block text-sm">Test selling price, before tax (₹)<input name="sell" type="number" min={0} max={10000000} step="0.01" required defaultValue={dish.sellingPricePaise / 100} className={costInput} /></label><div className="grid gap-3 sm:grid-cols-2">{dish.ingredients.filter(row => !row.missing).map(row => <label key={row.inventoryItemId} className="block text-xs">{row.name} (₹ / {row.unit})<input name={row.inventoryItemId} type="number" min={0} max={10000000} step="0.01" required defaultValue={row.costPerUnit / 100} className={costInput} /></label>)}</div><button disabled={scenario.isPending} className="min-h-11 rounded-full border border-primary px-5 text-sm font-semibold text-primary disabled:opacity-50">{scenario.isPending ? "Calculating…" : "Compare costs"}</button></form>
    {scenario.isError && <p role="alert" className="mt-3 text-sm text-error">{scenario.error.message}</p>}
    {dirty && scenario.data && <p role="status" className="mt-3 text-xs text-text-muted">Inputs changed. Compare again for an updated result.</p>}
    {result && <div aria-live="polite" className="mt-4 rounded-2xl bg-background p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-semibold">Scenario result</h4><Badge dish={result} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p className="text-text-muted">Cost / portion<strong className="mt-1 block text-text">{result.status === "incomplete" ? "Incomplete" : money(result.totalCostPaise)}</strong></p><p className="text-text-muted">Contribution / portion<strong className={`mt-1 block ${result.profitPaise < 0 ? "text-error" : "text-text"}`}>{result.status === "incomplete" ? "—" : money(result.profitPaise)}</strong></p><p className="text-text-muted">Change from current<strong className="mt-1 block text-text">{result.status === "incomplete" || dish.status === "incomplete" ? "—" : money(result.profitPaise - dish.profitPaise)}</strong></p><p className="text-text-muted">Margin<strong className="mt-1 block text-text">{result.status === "incomplete" ? "—" : percentage(result.marginPercent)}</strong></p></div><ul className="mt-4 space-y-2 text-xs text-text-muted">{result.explanations.map((text, index) => <li key={index}>{text}</li>)}</ul>{canManage && result.status !== "incomplete" && result.sellingPricePaise !== dish.sellingPricePaise && <><p className="mt-4 text-xs text-text-muted">Apply changes only the live menu selling price. Seasonal ingredient rates remain a preview.</p><button disabled={savePrice.isPending} onClick={() => savePrice.mutate(result.sellingPricePaise)} className="mt-2 min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50">{savePrice.isPending ? "Applying…" : `Apply ${money(result.sellingPricePaise)} to menu`}</button></>}</div>}
    {savePrice.isError && <p role="alert" className="mt-3 text-sm text-error">{savePrice.error.message}</p>}
  </div>;
}
