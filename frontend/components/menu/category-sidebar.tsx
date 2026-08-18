"use client";

import type { Category } from "@/lib/menu/types";

export function CategorySidebar({
  categories,
  activeCategoryId,
  onSelect,
  canManage,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
  canManage: boolean;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-3 shadow-sm md:w-56">
      <h3 className="px-3 pb-1 pt-1 text-small font-semibold uppercase tracking-wide text-text-muted">
        Categories
      </h3>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-lg px-3 py-2 text-left text-body font-medium transition-colors ${
          activeCategoryId === null
            ? "bg-primary/10 text-primary"
            : "text-text-muted hover:bg-background hover:text-text"
        }`}
      >
        All Dishes
      </button>

      {categories.map((category) => (
        <div key={category.id} className="group flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSelect(category.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-left text-body font-medium transition-colors ${
              activeCategoryId === category.id
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:bg-background hover:text-text"
            }`}
          >
            {category.name}
          </button>
          {canManage && (
            <span className="hidden gap-1 pr-2 text-small text-text-muted group-hover:flex">
              <button
                type="button"
                onClick={() => onEditCategory(category)}
                className="hover:text-secondary"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteCategory(category)}
                className="hover:text-error"
              >
                Delete
              </button>
            </span>
          )}
        </div>
      ))}

      {canManage && (
        <button
          type="button"
          onClick={onAddCategory}
          className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-small font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
        >
          + Add Category
        </button>
      )}
    </aside>
  );
}
