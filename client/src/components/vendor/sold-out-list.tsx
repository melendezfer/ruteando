"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { updateProduct } from "@/lib/api/products";
import { useUndoToast } from "@/lib/ui/undo-toast";
import type { components } from "@/lib/api/schema";

type Product = components["schemas"]["Product"];

/**
 * R3 — "¿Qué se acabó?" (Perfil 2.0 §4.6): un interruptor Disponible /
 * Agotado por producto, un toque, reversible con "Deshacer" (R4).
 */
export function SoldOutList({
  businessId,
  products,
  onChange,
  unavailableLabel = "Agotado",
}: {
  businessId: string;
  products: Product[];
  onChange: (product: Product) => void;
  unavailableLabel?: string;
}) {
  const showToast = useUndoToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setAvailable(product: Product, available: boolean): Promise<boolean> {
    if (!product.id || product.name == null || product.price == null) return false;
    setBusyId(product.id);
    setError(null);
    const result = await updateProduct(product.id, { name: product.name, price: product.price, available });
    setBusyId(null);
    if (!result.ok || !result.product) {
      setError("No pudimos cambiarlo. Revisa tu conexión e inténtalo de nuevo.");
      return false;
    }
    onChange(result.product);
    return true;
  }

  async function toggle(product: Product) {
    const next = !product.available;
    if (await setAvailable(product, next)) {
      showToast({
        message: `${product.name}: ${next ? "disponible" : unavailableLabel.toLowerCase()}`,
        onUndo: () => void setAvailable({ ...product, available: next }, !next),
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {products.length === 0 && (
        <p className="font-sans text-body-sm text-text-muted">Todavía no tienes productos en tu carta.</p>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className={`min-w-0 font-sans text-body ${product.available ? "text-text" : "text-text-muted line-through"}`}>
              {product.name}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(product.available)}
              aria-label={`${product.name}: ${product.available ? "disponible" : unavailableLabel.toLowerCase()}`}
              disabled={busyId === product.id}
              onClick={() => void toggle(product)}
              className={`min-h-11 min-w-28 shrink-0 rounded-full px-3 font-sans text-body-sm font-semibold disabled:opacity-60 ${
                product.available ? "bg-verde-suave text-verde-texto" : "bg-ambar-suave text-ambar-texto"
              }`}
            >
              {product.available ? "Disponible" : unavailableLabel}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="font-sans text-body-sm text-rojo-texto">{error}</p>}
      <Link
        href={`/negocios/${businessId}?agregar=producto`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-sans text-body-sm font-semibold text-terracota"
      >
        <Plus size={16} weight="bold" />
        Agregar producto
      </Link>
    </div>
  );
}
