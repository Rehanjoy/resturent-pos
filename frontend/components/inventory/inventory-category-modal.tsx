"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { InventoryCategory } from "@/lib/inventory/types";

/**
 * Inventory "Categories" management modal — matches the reference
 * screenshot (add/rename/reorder/delete in one dialog, not a sidebar like
 * the Menu module's category management). Reorder is up/down-arrow
 * swapping of `displayOrder` with the neighboring row rather than
 * drag-and-drop — same end result, no new dependency. Delete is blocked
 * server-side with `CATEGORY_HAS_ITEMS` when the category still has
 * inventory items in it (identical guard to Menu categories); the caller
 * surfaces that error via `deleteError`.
 */
export function InventoryCategoryModal({
  categories,
  onClose,
  onCreate,
  onRename,
  onReorder,
  onDelete,
  isSubmitting,
  errorMessage,
}: {
  categories: InventoryCategory[];
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (category: InventoryCategory, name: string) => void;
  onReorder: (category: InventoryCategory, direction: "up" | "down") => void;
  onDelete: (category: InventoryCategory) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Modal title="Inventory Categories" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {sorted.length === 0 && (
            <li className="py-4 text-center text-small text-text-muted">
              No inventory categories yet.
            </li>
          )}
          {sorted.map((category, index) => (
            <li
              key={category.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onReorder(category, "up")}
                  aria-label={`Move ${category.name} up`}
                  className="text-text-muted hover:text-primary disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === sorted.length - 1}
                  onClick={() => onReorder(category, "down")}
                  aria-label={`Move ${category.name} down`}
                  className="text-text-muted hover:text-primary disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              {editingId === category.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onRename(category, editingName.trim());
                    setEditingId(null);
                  }}
                >
                  <input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    autoFocus
                    className="flex-1 rounded-lg border border-border px-2 py-1.5 text-body text-text"
                  />
                  <button type="submit" className="text-small font-medium text-primary">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-small text-text-muted"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-body text-text">{category.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                    className="text-small font-medium text-secondary hover:underline"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(category)}
                    className="text-small font-medium text-error hover:underline"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        {errorMessage && <p className="text-small text-error">{errorMessage}</p>}

        <form
          className="flex items-center gap-2 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!newName.trim()) return;
            onCreate(newName.trim());
            setNewName("");
          }}
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="New category name"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-body text-text"
          />
          <button
            type="submit"
            disabled={isSubmitting || !newName.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-button text-white disabled:opacity-60"
          >
            Add
          </button>
        </form>
      </div>
    </Modal>
  );
}
