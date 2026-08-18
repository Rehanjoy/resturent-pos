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
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
          activeCategoryId === null
            ? "bg-primary text-white shadow-sm"
            : "border border-border text-text-muted hover:border-primary hover:text-primary"
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
              ? "bg-primary text-white shadow-sm"
              : "border border-border text-text-muted hover:border-primary hover:text-primary"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
