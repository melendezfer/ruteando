"use client";

import { Tray } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

// Íconos del registro único (lib/icons/semantic-icons.ts): "nombre del
// negocio" y "ítem de su carta/catálogo" ya no comparten ícono con
// "local fijo" (Storefront) ni con "oferta" (Tag).
const BusinessNameIcon = SEMANTIC_ICONS.businessName;
const CatalogIcon = SEMANTIC_ICONS.catalog;
import type { components } from "@/lib/api/schema";
import { formatCOP } from "@/lib/format/currency";

type Business = components["schemas"]["Business"];

interface MatchReasonBadgesProps {
  matchType: Business["matchType"];
  matchedProducts: Business["matchedProducts"];
  /**
   * Búsqueda por familia (Fase 5, CLAUDE.md sección 50) — independiente
   * de `matchType`: un negocio puede coincidir por categoría Y por
   * nombre/producto a la vez, así que este chip se muestra junto a los
   * demás, no en su lugar.
   */
  matchedCategory: Business["matchedCategory"];
  /** Nombre de la categoría a mostrar en el chip cuando `matchedCategory` es true — ya lo tiene cada caller (categoryNameById), no hace falta que el backend lo repita en la respuesta. */
  categoryName: string | null;
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
 * negocio, uno o más productos de su catálogo, su categoría (Fase 5,
 * búsqueda por familia), o cualquier combinación de las tres (petición
 * directa del usuario, Fases 2 y 5 de la fusión de buscadores, sin RF
 * asociado — ver CLAUDE.md sección 45/47/50). `matchType`/
 * `matchedProducts`/`matchedCategory` ya vienen calculados por el
 * backend (Fase 0/5) — este componente solo los traduce a chips, nunca
 * recalcula el match comparando texto en el cliente (regla de seguridad
 * #1).
 *
 * Sin ninguna señal activa (sin `q`, o con `q` pero sin que este negocio
 * calificara por nombre/producto/categoría — no debería pasar en la
 * práctica, pero no es responsabilidad de este componente asumirlo) no
 * renderiza nada, mismo criterio que AvailabilityConfirmedBadge.
 */
export function MatchReasonBadges({
  matchType,
  matchedProducts,
  matchedCategory,
  categoryName,
  showPrices,
}: MatchReasonBadgesProps) {
  const showName = matchType === "business_name" || matchType === "both";
  const products = matchedProducts ?? [];
  const visibleProducts = products.slice(0, MAX_PRODUCT_CHIPS);
  const extraCount = products.length - visibleProducts.length;
  const showCategory = Boolean(matchedCategory) && categoryName != null;

  if (!showName && visibleProducts.length === 0 && !showCategory) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showName && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-caption font-medium text-text-muted">
          <BusinessNameIcon size={12} weight="bold" />
          Nombre del negocio
        </span>
      )}
      {visibleProducts.map((product, index) => (
        <span
          key={product.name ?? index}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-caption font-medium text-text-muted"
        >
          <CatalogIcon size={12} weight="bold" />
          {product.name}
          {showPrices && product.price !== undefined ? ` · ${formatCOP(product.price)}` : ""}
        </span>
      ))}
      {extraCount > 0 && (
        <span className="font-sans text-caption text-text-muted">+{extraCount} más</span>
      )}
      {showCategory && (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 font-sans text-caption font-medium text-text-muted">
          <Tray size={12} weight="bold" />
          {categoryName}
        </span>
      )}
    </div>
  );
}
