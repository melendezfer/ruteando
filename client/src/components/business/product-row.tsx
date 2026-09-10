"use client";

import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";
import { formatCOP } from "@/lib/format/currency";

type Product = components["schemas"]["Product"];

interface ProductRowProps {
  product: Product;
  photoUrl: string | null;
  onExpand: (product: Product) => void;
}

/**
 * Plato del menú, expandible in-place (CLAUDE.md sección 17: "cada plato
 * se expande al tocarlo... sin navegar a otra pantalla"). `onExpand` se
 * dispara cada vez que se abre (no solo la primera vez) — es el mismo
 * criterio que un clic de analítica normal, no un "visto una sola vez".
 */
export function ProductRow({ product, photoUrl, onExpand }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand(product);
  }

  return (
    <div className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-title-2 font-semibold text-text">{product.name}</span>
          <span className="font-sans text-body-sm text-text-muted">
            {product.price !== undefined ? formatCOP(product.price) : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {product.available === false && (
            <span className="rounded-full bg-ambar/20 px-2 py-1 font-sans text-caption font-medium uppercase tracking-wide text-ambar">
              Agotado
            </span>
          )}
          {expanded ? (
            <CaretUp size={20} className="text-text-muted" />
          ) : (
            <CaretDown size={20} className="text-text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- foto remota de ancho variable, no vale la pena el pipeline de next/image para una sola foto por plato
            <img
              src={photoUrl}
              alt={product.name ?? "Producto"}
              className="h-40 w-full rounded-input object-cover"
            />
          )}
          <p className="font-sans text-body-sm text-text">
            {product.description ?? "Este plato todavía no tiene descripción."}
          </p>
        </div>
      )}
    </div>
  );
}
