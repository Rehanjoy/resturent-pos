"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productionApi } from "@/lib/inventory/api";
import type { InventoryItem, ProductionRequirement } from "@/lib/inventory/types";
import type { MenuItem } from "@/lib/menu/types";
import { formatStockQuantity, recipeUnits, toBaseQuantity } from "@/lib/inventory/units";
import { formatMoney } from "@/lib/format";
import {
  AlertTriangleIcon,
  ChefHatIcon,
  CheckCircleIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";

function istDay() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

const fineUnit = formatStockQuantity;

export function ProductionPlanner({
  menu,
  inventory,
  canManage,
}: {
  menu: MenuItem[];
  inventory: InventoryItem[];
  canManage: boolean;
}) {
  const cache = useQueryClient();
  const [open, setOpen] = useState(true);
  const [day, setDay] = useState(istDay);
  const [portions, setPortions] = useState<Record<string, number>>({});
  const [dishId, setDishId] = useState(menu[0]?.id ?? "");
  const activeDishId = dishId || menu[0]?.id || "";
  const dish = menu.find((item) => item.id === activeDishId);

  const [recipeDrafts, setRecipeDrafts] = useState<
    Record<
      string,
      {
        yieldPortions: number;
        ingredients: { inventoryItemId: string; quantity: number }[];
      }
    >
  >({});
  const [displayUnits, setDisplayUnits] = useState<Record<string, number>>({});
  const [actuals, setActuals] = useState<Record<string, { used: string; wasted: string }>>({});

  const plan = useQuery({
    queryKey: ["production-plan", day],
    queryFn: () => productionApi.get(day),
    enabled: open,
  });

  const savedPortions = useMemo(
    () =>
      Object.fromEntries(
        (plan.data?.plan?.dishes ?? []).map((row) => [row.menuItemId, row.portions])
      ),
    [plan.data?.plan?.dishes]
  );

  const defaultYield = dish?.recipeYield ?? 1;
  const defaultIngredients = (dish?.ingredientMapping ?? []).map((row) => ({
    inventoryItemId: row.inventoryItemId,
    quantity: row.quantityPerRecipe ?? row.quantityPerUnit * defaultYield,
  }));

  const recipeDraft = recipeDrafts[activeDishId];
  const yieldPortions = recipeDraft?.yieldPortions ?? defaultYield;
  const ingredients = recipeDraft?.ingredients ?? defaultIngredients;

  const setRecipeDraft = (
    next: Partial<{
      yieldPortions: number;
      ingredients: { inventoryItemId: string; quantity: number }[];
    }>
  ) => {
    if (!activeDishId) return;
    setRecipeDrafts((current) => ({
      ...current,
      [activeDishId]: { yieldPortions, ingredients, ...next },
    }));
  };

  const saveRecipe = useMutation({
    mutationFn: () => productionApi.saveRecipe(activeDishId, yieldPortions, ingredients),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["menu-items"] }),
  });

  const savePlan = useMutation({
    mutationFn: (targetDay: string) =>
      productionApi.savePlan(
        targetDay,
        menu
          .map((item) => ({
            menuItemId: item.id,
            portions: portions[item.id] ?? savedPortions[item.id] ?? 0,
          }))
          .filter((row) => row.portions > 0)
      ),
    onSuccess: (data, targetDay) => cache.setQueryData(["production-plan", targetDay], data),
  });

  const reconcile = useMutation({
    mutationFn: ({
      row,
      values,
    }: {
      row: ProductionRequirement;
      values: { used: number; wasted: number };
    }) =>
      productionApi.reconcile(plan.data!.plan!.id, row.itemId, {
        actualUsed: values.used,
        actualWasted: values.wasted,
        expectedStock: row.currentStock,
        recordedUsed: row.recordedUsed,
        recordedWasted: row.recordedWasted,
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["production-plan"] });
      cache.invalidateQueries({ queryKey: ["inventory-items"] });
    },
  });

  const shortageCount = plan.data?.requirements.filter((row) => row.shortage > 0).length ?? 0;

  const recipeCost = ingredients.reduce(
    (sum, row) =>
      sum +
      row.quantity *
        (inventory.find((item) => item.id === row.inventoryItemId)?.costPerUnit ?? 0),
    0
  );

  const costPerPortion = yieldPortions > 0 ? recipeCost / yieldPortions : 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-all">
      {/* Collapsible Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 bg-gradient-to-r from-surface to-background/50 border-b border-border/70">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
            <ChefHatIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-text">Recipe & Daily Production Planner</h2>
              {plan.data?.plan && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    shortageCount > 0
                      ? "bg-error/15 text-error"
                      : "bg-success/15 text-success"
                  }`}
                >
                  {shortageCount > 0 ? (
                    <>
                      <AlertTriangleIcon className="h-3 w-3" />
                      {shortageCount} shortage{shortageCount > 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-3 w-3" />
                      Stock sufficient
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              Set standard batch recipes, plan daily plate counts, and detect ingredient shortages before kitchen prep.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-text shadow-xs transition-colors hover:bg-background"
        >
          {open ? "Collapse planner" : "Open planner"}
        </button>
      </div>

      {open && (
        <div className="space-y-6 p-4 sm:p-6">
          {!menu.length && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-text">
              Add dishes in the <strong>Menu</strong> workspace first to start linking ingredients and planning recipes.
            </div>
          )}
          {!inventory.length && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-text">
              Add ingredients in the <strong>Ingredients</strong> tab before building recipes.
            </div>
          )}

          {/* STEP 1: RECIPE BUILDER */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-base font-semibold text-text">Set Standard Recipe</h3>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Configure raw ingredients required for 1 full batch. Quantities automatically scale to per-portion costs.
                </p>
              </div>

              {dish && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">Dish Selling Price</span>
                    <p className="text-sm font-bold text-text">{formatMoney(dish.price)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Dish & Yield Selectors */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text">Select Dish</span>
                <select
                  value={activeDishId}
                  onChange={(event) => setDishId(event.target.value)}
                  className="min-h-11 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text shadow-xs transition-colors focus:border-primary focus:outline-none"
                >
                  {menu.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatMoney(item.price)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-text">Batch Yield (Portions produced)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canManage || yieldPortions <= 1}
                    onClick={() => setRecipeDraft({ yieldPortions: Math.max(1, yieldPortions - 1) })}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-text transition-colors hover:bg-border/60 disabled:opacity-40"
                    title="Decrease portions"
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    disabled={!canManage}
                    min={1}
                    step={1}
                    value={yieldPortions}
                    onChange={(event) =>
                      setRecipeDraft({ yieldPortions: Math.max(1, Number(event.target.value)) })
                    }
                    className="min-h-11 flex-1 rounded-xl border border-border bg-surface px-3 text-center text-sm font-bold text-text shadow-xs transition-colors focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => setRecipeDraft({ yieldPortions: yieldPortions + 1 })}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-text transition-colors hover:bg-border/60 disabled:opacity-40"
                    title="Increase portions"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-medium text-text-muted whitespace-nowrap">
                    plates per batch
                  </span>
                </div>
              </label>
            </div>

            {/* Ingredients Table/List */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-muted">
                <span>Recipe Ingredients ({ingredients.length})</span>
                <span>Batch & Portion Impact</span>
              </div>

              {ingredients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-center text-xs text-text-muted">
                  No ingredients added yet for this recipe. Click <strong>+ Add Ingredient</strong> below to begin.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {ingredients.map((row, index) => {
                    const stock = inventory.find((item) => item.id === row.inventoryItemId);
                    const unitOptions = recipeUnits(stock?.unit ?? "unit");
                    const unitKey = `${activeDishId}-${index}-${row.inventoryItemId}`;
                    const factor = displayUnits[unitKey] ?? unitOptions[unitOptions.length - 1].factor;
                    const portionQty = row.quantity / yieldPortions;
                    const lineBatchCost = Math.round(row.quantity * (stock?.costPerUnit ?? 0));
                    const linePortionCost = Math.round(portionQty * (stock?.costPerUnit ?? 0));

                    return (
                      <div
                        key={`${row.inventoryItemId}-${index}`}
                        className="group flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 transition-all hover:border-primary/40 hover:shadow-xs md:flex-row md:items-center"
                      >
                        {/* Ingredient Selector */}
                        <div className="flex-1 min-w-48">
                          <label className="sr-only">Ingredient</label>
                          <select
                            disabled={!canManage}
                            value={row.inventoryItemId}
                            onChange={(event) =>
                              setRecipeDraft({
                                ingredients: ingredients.map((val, at) =>
                                  at === index
                                    ? { inventoryItemId: event.target.value, quantity: 0 }
                                    : val
                                ),
                              })
                            }
                            className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text shadow-2xs transition-colors focus:border-primary focus:outline-none"
                          >
                            {inventory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit}) — In Stock: {item.currentStock} {item.unit}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity & Unit in neat combo */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-28">
                            <label className="sr-only">Quantity</label>
                            <input
                              type="number"
                              min={factor / 1000000}
                              step={factor / 1000000}
                              disabled={!canManage}
                              value={Number((row.quantity * factor).toFixed(6))}
                              onChange={(event) =>
                                setRecipeDraft({
                                  ingredients: ingredients.map((val, at) =>
                                    at === index
                                      ? {
                                          ...val,
                                          quantity: toBaseQuantity(Number(event.target.value), factor),
                                        }
                                      : val
                                  ),
                                })
                              }
                              placeholder="0.00"
                              className="min-h-11 w-full rounded-xl border border-border bg-surface px-3 text-right text-xs font-bold text-text shadow-2xs transition-colors focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div className="w-20">
                            <label className="sr-only">Unit</label>
                            <select
                              value={factor}
                              onChange={(event) =>
                                setDisplayUnits((current) => ({
                                  ...current,
                                  [unitKey]: Number(event.target.value),
                                }))
                              }
                              className="min-h-11 w-full rounded-xl border border-border bg-background px-2 text-xs font-medium text-text shadow-2xs focus:border-primary focus:outline-none"
                            >
                              {unitOptions.map((option) => (
                                <option key={option.label} value={option.factor}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Portion & Cost Summary Badge */}
                        <div className="flex flex-1 items-center justify-between gap-2 rounded-xl bg-background/80 px-3 py-2 text-xs md:justify-end">
                          {stock && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-right">
                              <span className="text-text-muted">
                                Per plate:{" "}
                                <strong className="font-semibold text-text">
                                  {fineUnit(portionQty, stock.unit)}
                                </strong>
                              </span>
                              <span className="hidden sm:inline text-border">•</span>
                              <span className="text-text-muted">
                                Plate cost:{" "}
                                <strong className="font-semibold text-text">
                                  {formatMoney(linePortionCost)}
                                </strong>
                              </span>
                              <span className="hidden sm:inline text-border">•</span>
                              <span className="text-text-muted">
                                Batch:{" "}
                                <strong className="font-semibold text-text">
                                  {formatMoney(lineBatchCost)}
                                </strong>
                              </span>
                            </div>
                          )}

                          {/* Delete Button */}
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() =>
                              setRecipeDraft({
                                ingredients: ingredients.filter((_, at) => at !== index),
                              })
                            }
                            aria-label={`Remove ingredient ${index + 1}`}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-30"
                            title="Remove from recipe"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recipe Action Bar & Cost Summary */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/50 p-4">
                <button
                  type="button"
                  disabled={!canManage || ingredients.length >= inventory.length}
                  onClick={() =>
                    setRecipeDraft({
                      ingredients: [
                        ...ingredients,
                        {
                          inventoryItemId:
                            inventory.find(
                              (item) => !ingredients.some((row) => row.inventoryItemId === item.id)
                            )?.id ??
                            inventory[0]?.id ??
                            "",
                          quantity: 0.1,
                        },
                      ],
                    })
                  }
                  className="flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-text shadow-xs transition-colors hover:bg-background"
                >
                  <PlusIcon className="h-3.5 w-3.5 text-primary" />
                  Add Ingredient
                </button>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-surface px-3 py-1.5 border border-border text-right">
                      <span className="block text-[10px] uppercase font-semibold text-text-muted">
                        Batch Cost ({yieldPortions} plates)
                      </span>
                      <strong className="text-sm font-bold text-text">
                        {formatMoney(Math.round(recipeCost))}
                      </strong>
                    </div>
                    <div className="rounded-lg bg-surface px-3 py-1.5 border border-border text-right">
                      <span className="block text-[10px] uppercase font-semibold text-text-muted">
                        Cost / Portion
                      </span>
                      <strong className="text-sm font-bold text-primary">
                        {formatMoney(Math.round(costPerPortion))}
                      </strong>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      disabled={
                        !activeDishId ||
                        !ingredients.length ||
                        ingredients.some(
                          (row) => !Number.isFinite(row.quantity) || row.quantity <= 0
                        ) ||
                        new Set(ingredients.map((row) => row.inventoryItemId)).size !==
                          ingredients.length ||
                        saveRecipe.isPending
                      }
                      onClick={() => saveRecipe.mutate()}
                      className="min-h-10 rounded-xl bg-accent px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary disabled:opacity-40"
                    >
                      {saveRecipe.isPending ? "Saving..." : "Save Recipe"}
                    </button>
                  )}
                </div>
              </div>

              {saveRecipe.isSuccess && (
                <p role="status" className="mt-2 text-xs font-semibold text-success flex items-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Standard recipe saved successfully. Live menu and future orders will calculate from these portions.
                </p>
              )}
              {saveRecipe.isError && (
                <p role="alert" className="mt-2 text-xs font-semibold text-error">
                  {saveRecipe.error.message}
                </p>
              )}
            </div>
          </div>

          {/* STEP 2: DAILY PORTION PLANNER */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-base font-semibold text-text">Daily Portion Planning</h3>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  Estimate the number of portions planned for kitchen prep today or upcoming shifts.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = istDay();
                    setDay(todayStr);
                    setPortions({});
                    setActuals({});
                    savePlan.reset();
                    reconcile.reset();
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    day === istDay()
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border text-text-muted hover:text-text"
                  }`}
                >
                  Today (IST)
                </button>
                <input
                  type="date"
                  value={day}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setDay(event.target.value);
                    setPortions({});
                    setActuals({});
                    savePlan.reset();
                    reconcile.reset();
                  }}
                  className="min-h-9 rounded-xl border border-border bg-surface px-3 py-1 text-xs font-semibold text-text shadow-2xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Dish Cards Grid */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menu.map((item) => {
                const currentCount = portions[item.id] ?? savedPortions[item.id] ?? 0;
                const hasRecipe = (item.ingredientMapping?.length ?? 0) > 0;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/50 p-3 transition-colors hover:border-border/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-text">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-text-muted">{formatMoney(item.price)}</span>
                        {!hasRecipe && (
                          <span className="text-[10px] text-warning bg-warning/10 px-1.5 rounded">
                            No recipe linked
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={!canManage || plan.isLoading || currentCount <= 0}
                        onClick={() =>
                          setPortions((current) => ({
                            ...current,
                            [item.id]: Math.max(0, currentCount - 5),
                          }))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text hover:bg-border/40 disabled:opacity-30"
                        title="-5 portions"
                      >
                        <MinusIcon className="h-3.5 w-3.5" />
                      </button>

                      <input
                        aria-label={`Planned portions for ${item.name}`}
                        type="number"
                        disabled={!canManage || plan.isLoading}
                        min={0}
                        step={1}
                        value={currentCount}
                        onChange={(event) =>
                          setPortions((current) => ({
                            ...current,
                            [item.id]: Math.max(0, Number(event.target.value)),
                          }))
                        }
                        className="h-8 w-14 rounded-lg border border-border bg-surface px-1 text-center text-xs font-bold text-text shadow-2xs focus:border-primary focus:outline-none"
                      />

                      <button
                        type="button"
                        disabled={!canManage || plan.isLoading}
                        onClick={() =>
                          setPortions((current) => ({
                            ...current,
                            [item.id]: currentCount + 5,
                          }))
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text hover:bg-border/40 disabled:opacity-30"
                        title="+5 portions"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-text-muted">
                Worksheet calculations estimate daily ingredient burn. Stock balance is only deducted when orders complete.
              </span>

              <button
                type="button"
                disabled={
                  !canManage ||
                  plan.isLoading ||
                  !menu.some((item) => (portions[item.id] ?? savedPortions[item.id] ?? 0) > 0) ||
                  savePlan.isPending
                }
                onClick={() => savePlan.mutate(day)}
                className="min-h-10 rounded-xl bg-primary px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-40"
              >
                {savePlan.isPending ? "Calculating..." : "Save Plan & Calculate Stock Needs"}
              </button>
            </div>

            {savePlan.isError && (
              <p role="alert" className="mt-2 text-xs font-semibold text-error">
                {savePlan.error.message}
              </p>
            )}
          </div>

          {/* STEP 3: INGREDIENT REQUIREMENTS & SHORTAGES */}
          {plan.data?.plan && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                      3
                    </span>
                    <h3 className="text-base font-semibold text-text">Ingredient Requirements & Shortages</h3>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{plan.data.note}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">Total Day Cost</span>
                    <p className="text-base font-bold text-text">
                      {formatMoney(plan.data.totalCostPaise)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      shortageCount > 0
                        ? "bg-error/15 text-error"
                        : "bg-success/15 text-success"
                    }`}
                  >
                    {shortageCount > 0 ? `${shortageCount} shortages detected` : "All ingredients sufficient"}
                  </span>
                </div>
              </div>

              {/* Requirements Grid */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {plan.data.requirements.map((row) => {
                  const hasShortage = row.shortage > 0;
                  const availablePercent =
                    row.required > 0
                      ? Math.min(100, Math.round((row.currentStock / row.required) * 100))
                      : 100;

                  return (
                    <article
                      key={row.itemId}
                      className={`rounded-xl border p-4 transition-all ${
                        hasShortage
                          ? "border-error/40 bg-error/5"
                          : "border-border bg-surface hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-text">{row.name}</h4>
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="text-text-muted">
                              Need: <strong className="text-text font-semibold">{fineUnit(row.required, row.unit)}</strong>
                            </span>
                            <span className="text-border">•</span>
                            <span className="text-text-muted">
                              In Stock:{" "}
                              <strong className={`font-semibold ${row.currentStock <= 0 ? "text-error" : "text-text"}`}>
                                {fineUnit(row.currentStock, row.unit)}
                              </strong>
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <strong className="block text-sm font-bold text-text">
                            {formatMoney(row.costPaise)}
                          </strong>
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              hasShortage
                                ? "bg-error/20 text-error"
                                : "bg-success/15 text-success"
                            }`}
                          >
                            {hasShortage ? `Short by ${fineUnit(row.shortage, row.unit)}` : "Sufficient"}
                          </span>
                        </div>
                      </div>

                      {/* Stock availability meter */}
                      <div className="mt-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                          <div
                            className={`h-full rounded-full transition-all ${
                              hasShortage ? "bg-error" : "bg-success"
                            }`}
                            style={{ width: `${availablePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Day Reconciliation for Past Closed Days */}
                      {canManage && day < istDay() && !row.reconciled && (
                        <div className="mt-4 border-t border-border/60 pt-3">
                          <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                            Closed Day Reconciliation
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="text-[11px] font-medium text-text">
                              Actual Used ({row.unit})
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={actuals[row.itemId]?.used ?? String(row.recordedUsed)}
                                onChange={(event) =>
                                  setActuals((current) => ({
                                    ...current,
                                    [row.itemId]: {
                                      used: event.target.value,
                                      wasted: current[row.itemId]?.wasted ?? String(row.recordedWasted),
                                    },
                                  }))
                                }
                                className="mt-1 min-h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs"
                              />
                            </label>

                            <label className="text-[11px] font-medium text-text">
                              Actual Waste ({row.unit})
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={actuals[row.itemId]?.wasted ?? String(row.recordedWasted)}
                                onChange={(event) =>
                                  setActuals((current) => ({
                                    ...current,
                                    [row.itemId]: {
                                      used: current[row.itemId]?.used ?? String(row.recordedUsed),
                                      wasted: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 min-h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs"
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            disabled={reconcile.isPending}
                            onClick={() =>
                              reconcile.mutate({
                                row,
                                values: {
                                  used: Number(actuals[row.itemId]?.used ?? row.recordedUsed),
                                  wasted: Number(actuals[row.itemId]?.wasted ?? row.recordedWasted),
                                },
                              })
                            }
                            className="mt-3 w-full rounded-lg border border-primary bg-primary/5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
                          >
                            Reconcile Closed Day
                          </button>
                        </div>
                      )}

                      {row.reconciled && (
                        <p className="mt-3 text-xs font-medium text-success flex items-center gap-1">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Measured day reconciled: used {fineUnit(row.actualUsed ?? 0, row.unit)}, waste{" "}
                          {fineUnit(row.actualWasted ?? 0, row.unit)}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
