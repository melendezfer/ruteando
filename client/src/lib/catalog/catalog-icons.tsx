import type { Icon } from "@phosphor-icons/react";
import { Briefcase, CookingPot, Package, Storefront } from "@phosphor-icons/react/dist/ssr";
import type { CatalogType } from "@/lib/catalog/catalog-label";

/**
 * Ícono por tipo de catálogo (`Category.type` — food/goods/services),
 * extraído de `business-profile-screen.tsx` (donde nació como
 * `HERO_FALLBACK_ICON_BY_TYPE`, ver CLAUDE.md sección 31) para
 * reusarse también en el banner de descubrimiento
 * (`discovery-banner.tsx`) sin duplicar la correspondencia — mismo
 * criterio ya establecido en este archivo del proyecto (catalog-label.ts,
 * review-tags.ts): un solo lugar evita que dos pantallas diverjan sobre
 * qué ícono representa cada tipo de negocio.
 */
export const CATALOG_ICON_BY_TYPE: Record<CatalogType, Icon> = {
  food: CookingPot,
  goods: Package,
  services: Briefcase,
};

/** Sin `type` resuelto (categoría todavía sin cargar, o id desconocido) cae en el mismo ícono genérico de marca que ya usaba business-profile-screen.tsx antes de esta extracción. */
export const DEFAULT_CATALOG_ICON: Icon = Storefront;

/**
 * Para un lookup dentro de un callback (ej. `businesses.map(...)` en
 * discovery-banner.tsx) — para el cuerpo de un componente en sí, usar
 * el lookup directo contra `CATALOG_ICON_BY_TYPE`/`DEFAULT_CATALOG_ICON`
 * (ver business-profile-screen.tsx): la regla `react-hooks/static-components`
 * marca como error asignar a una variable con mayúscula inicial, usada
 * luego como tag JSX, el resultado de una LLAMADA a función en el
 * cuerpo de un componente — no distingue que esta función siempre
 * devuelve la misma referencia estable para el mismo `type` (no crea un
 * componente nuevo en cada render); dentro de un callback de `.map()`
 * esa regla no se dispara, verificado con `npx eslint` sobre este mismo
 * cambio.
 */
export function resolveCatalogIcon(type: CatalogType | null | undefined): Icon {
  return type ? CATALOG_ICON_BY_TYPE[type] : DEFAULT_CATALOG_ICON;
}
