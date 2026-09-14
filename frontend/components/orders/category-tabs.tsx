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
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 [&>button]:min-h-11 [&>button]:shrink-0">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
          activeCategoryId === null
            ? "border border-primary bg-primary/5 text-primary"
            : "border border-border text-text-muted hover:border-primary hover:text-primary"
        }`}
      >
        All Menu
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          className={`rounded-full px-4 py-1.5 text-small font-medium transition-colors ${
            activeCategoryId === category.id
              ? "border border-primary bg-primary/5 text-primary"
              : "border border-border text-text-muted hover:border-primary hover:text-primary"
          }`}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
