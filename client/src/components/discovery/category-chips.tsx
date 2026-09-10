"use client";

import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";

type Category = components["schemas"]["Category"];

interface CategoryChipsProps {
  categories: Category[];
  loading: boolean;
  selectedCategoryId: number | null;
  onSelect: (categoryId: number | null) => void;
}

/**
 * Categorías rápidas (Documento 08, sección 5.4.1) — fila horizontal de
 * chips, no una lista vertical con scroll infinito. Tocar la categoría ya
 * activa la vuelve a desactivar (vuelve a "cerca de ti").
 */
export function CategoryChips({ categories, loading, selectedCategoryId, onSelect }: CategoryChipsProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Categorías">
      {categories.map((category) => {
        const active = category.id === selectedCategoryId;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? null : (category.id ?? null))}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-sans text-body-sm font-medium transition-colors ${
              active
                ? "bg-terracota text-white"
                : "border border-border bg-surface text-text hover:bg-background"
            }`}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
