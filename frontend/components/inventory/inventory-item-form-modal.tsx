"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import type { InventoryCategory, InventoryItem, Supplier } from "@/lib/inventory/types";

const ADD_SUPPLIER_VALUE = "__add_supplier__";

/**
 * Add/Edit Inventory Item. `currentStock` is only editable here on *add*
 * (it's the opening balance) — on edit it's shown read-only with a pointer
 * to the Adjust action, matching the backend rule that every stock
 * reduction must go through the audited adjustment endpoint
 * (`STOCK_DECREASE_NOT_ALLOWED`, see `inventory-item.service.ts`).
 */
export function InventoryItemFormModal({
  item,
  categories,
  suppliers,
  defaultCategoryId,
  onClose,
  onSubmit,
  onRequestAddSupplier,
  isSubmitting,
  errorMessage,
}: {
  item: InventoryItem | null;
  categories: InventoryCategory[];
  suppliers: Supplier[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    categoryId: string;
    name: string;
    unit: string;
    costPerUnit: number;
    currentStock?: number;
    reorderThreshold?: number;
    expectedDailyUsage?: number;
    supplierId?: string;
  }) => void;
  onRequestAddSupplier: () => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "kg");
  const [costRupees, setCostRupees] = useState(item ? paiseToRupeesInput(item.costPerUnit) : "");
  const [openingStock, setOpeningStock] = useState(
    item ? String(item.currentStock) : "0",
  );
  const [reorderThreshold, setReorderThreshold] = useState(
    item ? String(item.reorderThreshold) : "0",
  );
  const [expectedDailyUsage, setExpectedDailyUsage] = useState(String(item?.expectedDailyUsage ?? 0));
  const [supplierId, setSupplierId] = useState(item?.supplierId ?? "");

  return (
    <Modal title={item ? "Edit Inventory Item" : "Add Inventory Item"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            categoryId,
            name: name.trim(),
            unit: unit.trim(),
            costPerUnit: rupeesToPaise(Number(costRupees)),
            currentStock: item ? undefined : Number(openingStock),
            reorderThreshold: Number(reorderThreshold),
            expectedDailyUsage: Number(expectedDailyUsage),
            supplierId: supplierId || undefined,
          });
        }}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto"
      >
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Category</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
          >
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Item name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Basmati Rice"
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Stock base unit</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              required
              placeholder="kg, L, pcs…"
              list="inventory-base-units"
              readOnly={!!item}
              className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Purchase cost / {unit || "unit"} (₹)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={costRupees}
              onChange={(event) => setCostRupees(event.target.value)}
              required
              className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
            />
          </label>
        </div>

        <datalist id="inventory-base-units"><option value="kg" /><option value="L" /><option value="pcs" /></datalist>
        <p className="text-small text-text-muted">Stock and purchase cost use this same base unit. Recipes can enter grams for kg or ml for L. 1 g = 0.001 kg; quantities support six decimal places.{item ? " Existing base units stay fixed so linked recipes remain consistent." : ""}</p>
        <div className="grid grid-cols-2 gap-3">
          {item ? (
            <div className="flex flex-col gap-1">
              <span className="text-small font-medium text-text">Current stock</span>
              <p className="min-h-11 rounded-lg border border-dashed border-border px-3 py-2 text-body text-text-muted">
                {item.currentStock} {item.unit}
              </p>
              <span className="text-small text-text-muted">Use “Adjust” to change this.</span>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-small font-medium text-text">Opening stock</span>
              <input
                type="number"
                step="0.000001"
                value={openingStock}
                onChange={(event) => setOpeningStock(event.target.value)}
                className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-small font-medium text-text">Reorder threshold</span>
            <input
              type="number"
              min={0}
              step="0.000001"
              value={reorderThreshold}
              onChange={(event) => setReorderThreshold(event.target.value)}
              className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Expected daily usage ({unit})</span>
          <input type="number" min={0} step="0.000001" value={expectedDailyUsage}
            onChange={(event) => setExpectedDailyUsage(event.target.value)}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text" />
          <span className="text-small text-text-muted">Used to estimate days remaining. Set 0 if unknown; this does not deduct stock.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Supplier</span>
          <select
            value={supplierId}
            onChange={(event) => {
              if (event.target.value === ADD_SUPPLIER_VALUE) {
                onRequestAddSupplier();
                return;
              }
              setSupplierId(event.target.value);
            }}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-body text-text"
          >
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
            <option value={ADD_SUPPLIER_VALUE}>+ Add new supplier…</option>
          </select>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !categoryId || !costRupees}
            className="min-h-11 rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
