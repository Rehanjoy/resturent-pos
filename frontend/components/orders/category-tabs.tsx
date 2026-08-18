"use client";

import type { Category } from "@/lib/menu/types";

/**
 * Horizontal category tabs across the top of the New/Active Order screen
 * (client's reference-screenshot layout, per `docs/01-product-brief.md`
 * §2) — active tab outlined in the brand primary color.
 */
export function CategoryTabs({
  categories,
  activeCategoryId,
  onSelect,
}: {
  categories: Category[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
          activeCategoryId === null
            ? "border border-primary text-primary"
            : "border border-border text-text-muted hover:text-text"
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
            activeCategoryId === category.id
              ? "border border-primary text-primary"
              : "border border-border text-text-muted hover:text-text"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
