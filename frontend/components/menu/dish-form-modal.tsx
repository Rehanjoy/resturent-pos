"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { inventoryItemsApi } from "@/lib/inventory/api";
import { menuItemsApi } from "@/lib/menu/api";
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
  const [imagePreview, setImagePreview] = useState(item?.imageUrl ?? "");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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

  async function selectImage(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError("Image must be 3 MB or smaller.");
      return;
    }

    const previousUrl = imageUrl;
    const localPreview = URL.createObjectURL(file);
    setImagePreview(localPreview);
    setImageError(null);
    setIsUploadingImage(true);
    try {
      const result = await menuItemsApi.uploadImage(file);
      setImageUrl(result.imageUrl);
      setImagePreview(result.imageUrl);
    } catch (error) {
      setImagePreview(previousUrl);
      setImageError(error instanceof ApiError ? error.message : "Could not upload the image. Try again.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
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
            imageUrl,
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

        <section aria-labelledby="dish-image-label" className="rounded-2xl border border-border/80 bg-background/45 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span id="dish-image-label" className="text-small font-semibold text-text">Dish photo</span>
              <p className="mt-0.5 text-xs text-text-muted">JPG, PNG or WebP · up to 3 MB</p>
            </div>
            {imagePreview ? <button type="button" onClick={() => { setImageUrl(""); setImagePreview(""); setImageError(null); }} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-error transition hover:bg-error/10">Remove</button> : null}
          </div>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void selectImage(event.target.files?.[0])} />
          {imagePreview ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Dish preview" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text">{isUploadingImage ? "Uploading photo…" : "Photo ready"}</p>
                <p className="mt-1 text-[11px] leading-4 text-text-muted">A clear landscape photo works best on menu cards.</p>
                <button type="button" disabled={isUploadingImage} onClick={() => imageInputRef.current?.click()} className="mt-2 min-h-9 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-primary disabled:opacity-50">Replace photo</button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={isUploadingImage} onClick={() => imageInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void selectImage(event.dataTransfer.files?.[0]); }} className="mt-3 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-white/55 px-4 text-center transition hover:border-primary/60 hover:bg-white disabled:opacity-60">
              <span className="text-sm font-semibold text-primary">{isUploadingImage ? "Uploading…" : "Choose a dish photo"}</span>
              <span className="mt-1 text-xs text-text-muted">Click to browse or drop an image here</span>
            </button>
          )}
          {isUploadingImage ? <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary" /></div> : null}
          {imageError ? <p role="alert" className="mt-2 text-xs font-medium text-error">{imageError}</p> : null}
        </section>

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

        <div className="flex items-center gap-2">
          <ToggleSwitch checked={isAvailable} onChange={setIsAvailable} label="Available on the menu" />
          <span className="text-small font-medium text-text">Available on the menu</span>
        </div>

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
            disabled={isSubmitting || isUploadingImage || !name.trim() || !categoryId || !priceRupees}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isUploadingImage ? "Uploading photo…" : isSubmitting ? "Saving…" : "Save dish"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
