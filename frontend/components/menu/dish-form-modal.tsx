"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import { inventoryItemsApi } from "@/lib/inventory/api";
import type { Category, IngredientMapping, MenuItem, MenuItemType, SpiceLevel } from "@/lib/menu/types";

let ingredientRowKeySeq = 0;
interface IngredientRow extends IngredientMapping {
  key: number;
}

export function DishFormModal({
  item,
  categories,
  defaultCategoryId,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: {
  item: MenuItem | null;
  categories: Category[];
  defaultCategoryId: string | null;
  onClose: () => void;
  onSubmit: (input: {
    categoryId: string;
    name: string;
    description?: string;
    price: number;
    type: MenuItemType;
    spiceLevel?: SpiceLevel;
    imageUrl?: string;
    isAvailable?: boolean;
    ingredientMapping?: IngredientMapping[];
  }) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [categoryId, setCategoryId] = useState(
    item?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? "",
  );
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceRupees, setPriceRupees] = useState(
    item ? paiseToRupeesInput(item.price) : "",
  );
  const [type, setType] = useState<MenuItemType>(item?.type ?? "veg");
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(item?.spiceLevel ?? "none");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(() =>
    (item?.ingredientMapping ?? []).map((entry) => ({ ...entry, key: ingredientRowKeySeq++ })),
  );

  // Inventory items to populate the ingredient picker (PRD §3.8
  // "ingredient-to-inventory linking"). Owner/Manager always has Inventory
  // access when they can reach this dish form, so no extra RBAC gate is
  // needed here — the list is simply empty (with a helpful hint) for a
  // restaurant that hasn't set up inventory items yet.
  const inventoryItemsQuery = useQuery({
    queryKey: ["inventory-items", ""],
    queryFn: () => inventoryItemsApi.list(),
  });
  const inventoryItems = inventoryItemsQuery.data?.inventoryItems ?? [];

  function addIngredientRow() {
    setIngredientRows((rows) => [
      ...rows,
      { key: ingredientRowKeySeq++, inventoryItemId: inventoryItems[0]?.id ?? "", quantityPerUnit: 0 },
    ]);
  }

  function updateIngredientRow(key: number, patch: Partial<IngredientMapping>) {
    setIngredientRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeIngredientRow(key: number) {
    setIngredientRows((rows) => rows.filter((row) => row.key !== key));
  }

  return (
    <Modal title={item ? "Edit Dish" : "Add Dish"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const ingredientMapping = ingredientRows
            .filter((row) => row.inventoryItemId && row.quantityPerUnit > 0)
            .map((row) => ({ inventoryItemId: row.inventoryItemId, quantityPerUnit: row.quantityPerUnit }));
          onSubmit({
            categoryId,
            name: name.trim(),
            description: description.trim() || undefined,
            price: rupeesToPaise(Number(priceRupees)),
            type,
            spiceLevel: spiceLevel === "none" ? undefined : spiceLevel,
            imageUrl: imageUrl.trim() || undefined,
            isAvailable,
            ingredientMapping,
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
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
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
          <span className="text-small font-medium text-text">Dish name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="e.g. Paneer Tikka"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Price (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={priceRupees}
            onChange={(event) => setPriceRupees(event.target.value)}
            required
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MenuItemType)}
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          >
            <option value="veg">Veg</option>
            <option value="non-veg">Non-Veg</option>
            <option value="egg">Egg</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Spice level</span>
          <select
            value={spiceLevel}
            onChange={(event) => setSpiceLevel(event.target.value as SpiceLevel)}
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          >
            <option value="none">Not applicable</option>
            <option value="mild">Mild</option>
            <option value="medium">Medium</option>
            <option value="spicy">Spicy</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Image URL</span>
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://…"
            className="rounded-lg border border-border px-3 py-2 text-body text-text"
          />
          {/* TODO: replace with a proper upload widget once S3/file storage is wired up (PRD §5.5). */}
          <span className="text-small text-text-muted">
            Paste an image URL for now — direct upload comes later.
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-small font-medium text-text">Ingredients used</span>
          <p className="text-small text-text-muted">
            Links this dish to Inventory so stock auto-deducts when it&apos;s sent to the kitchen
            (PRD §3.9).
          </p>

          {ingredientRows.length === 0 && (
            <p className="text-small text-text-muted">No ingredients linked yet.</p>
          )}

          {ingredientRows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <select
                value={row.inventoryItemId}
                onChange={(event) =>
                  updateIngredientRow(row.key, { inventoryItemId: event.target.value })
                }
                className="flex-1 rounded-lg border border-border px-3 py-2 text-body text-text"
              >
                <option value="">Select an item…</option>
                {inventoryItems.map((inventoryItem) => (
                  <option key={inventoryItem.id} value={inventoryItem.id}>
                    {inventoryItem.name} ({inventoryItem.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                value={row.quantityPerUnit || ""}
                onChange={(event) =>
                  updateIngredientRow(row.key, { quantityPerUnit: Number(event.target.value) })
                }
                placeholder="Qty used"
                className="w-28 rounded-lg border border-border px-3 py-2 text-body text-text"
              />
              <button
                type="button"
                onClick={() => removeIngredientRow(row.key)}
                aria-label="Remove ingredient"
                className="text-small text-error hover:underline"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addIngredientRow}
            disabled={inventoryItems.length === 0}
            title={inventoryItems.length === 0 ? "Add inventory items first" : undefined}
            className="self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-small font-medium text-text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            + Add ingredient
          </button>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
          />
          <span className="text-small font-medium text-text">Available on the menu</span>
        </label>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !categoryId || !priceRupees}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
