"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { paiseToRupeesInput, rupeesToPaise } from "@/lib/format";
import type { Category, MenuItem, MenuItemType, SpiceLevel } from "@/lib/menu/types";

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

  return (
    <Modal title={item ? "Edit Dish" : "Add Dish"} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            categoryId,
            name: name.trim(),
            description: description.trim() || undefined,
            price: rupeesToPaise(Number(priceRupees)),
            type,
            spiceLevel: spiceLevel === "none" ? undefined : spiceLevel,
            imageUrl: imageUrl.trim() || undefined,
            isAvailable,
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-small font-medium text-text">Type</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MenuItemType)}
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
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
            className="rounded-md border border-border px-3 py-2 text-body text-text"
          />
          {/* TODO: replace with a proper upload widget once S3/file storage is wired up (PRD §5.5). */}
          <span className="text-small text-text-muted">
            Paste an image URL for now — direct upload comes later.
          </span>
        </label>

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
            className="rounded-md border border-border px-4 py-2 text-button text-text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || !categoryId || !priceRupees}
            className="rounded-md bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
