"use client";

import { Storefront, Tag } from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";
import { formatCOP } from "@/lib/format/currency";

type Business = components["schemas"]["Business"];

interface MatchReasonBadgesProps {
  matchType: Business["matchType"];
  matchedProducts: Business["matchedProducts"];
  /**
   * Modo sencillo/avanzado (Fase 3, CLAUDE.md sección 48) — en modo
   * sencillo, el chip de producto muestra solo el nombre, sin precio.
   * Sin default a propósito: cada caller decide explícitamente en qué
   * modo está mostrando resultados, no hay un valor "razonable" a
   * asumir en silencio para un dato tan visible como un precio.
   */
  showPrices: boolean;
}

// Compacto a propósito: un negocio con muchos productos coincidentes (ej.
// "Arepas Doña Rosa" buscando "arepa", con 4 platos que empiezan así) no
// debe convertir la tarjeta colapsada en una lista larga — se muestran
// los primeros y el resto queda resumido en "+N más".
const MAX_PRODUCT_CHIPS = 2;

/**
 * Por qué un resultado coincidió con la búsqueda de texto — nombre del
 * negocio, uno o más productos de su catálogo, o ambos a la vez
 * (petición directa del usuario, Fase 2 de la fusión de buscadores, sin
 * RF asociado — ver CLAUDE.md sección 45/47). `matchType`/
 * `matchedProducts` ya vienen calculados por el backend (Fase 0,
 * negocios.repository.js#columnaNombreCoincide/lateralProductosCoincidentes)
 * — este componente solo los traduce a chips, nunca recalcula el match
 * comparando texto en el cliente (regla de seguridad #1).
 *
 * `matchType` es `null` cuando la búsqueda actual no incluyó `q`
 * (navegación normal, "cerca de ti", categoría) — en ese caso no
 * renderiza nada, mismo criterio que AvailabilityConfirmedBadge.
 */
export function MatchReasonBadges({ matchType, matchedProducts, showPrices }: MatchReasonBadgesProps) {
  if (!matchType) return null;

  const showName = matchType === "business_name" || matchType === "both";
  const products = matchedProducts ?? [];
  const visibleProducts = products.slice(0, MAX_PRODUCT_CHIPS);
  const extraCount = products.length - visibleProducts.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showName && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-caption font-medium text-text-muted">
          <Storefront size={12} weight="bold" />
          Nombre del negocio
        </span>
      )}
      {visibleProducts.map((product, index) => (
        <span
          key={product.name ?? index}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-caption font-medium text-text-muted"
        >
          <Tag size={12} weight="bold" />
          {product.name}
          {showPrices && product.price !== undefined ? ` · ${formatCOP(product.price)}` : ""}
        </span>
      ))}
      {extraCount > 0 && (
        <span className="font-sans text-caption text-text-muted">+{extraCount} más</span>
      )}
    </div>
  );
}
