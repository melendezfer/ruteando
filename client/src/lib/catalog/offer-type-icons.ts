import type { Icon } from "@phosphor-icons/react";
import { CalendarStar, ForkKnife, Package, Percent } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

/**
 * Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
 * ver CLAUDE.md, migración tipos-oferta. `OfferType.icon` viaja como
 * texto plano (los 4 sembrados de fábrica: 'fork-knife'/'percent'/'package'/
 * 'calendar-star') — este es el único lugar del frontend que traduce
 * ese texto a un ícono de Phosphor real, mismo criterio que
 * catalog-icons.tsx con `Category.type`. Un tipo de oferta nuevo,
 * agregado desde el admin CRUD con un nombre de ícono que no está en
 * este mapa, cae en `DEFAULT_OFFER_TYPE_ICON` en vez de romper — no hay
 * forma de que el frontend valide contra el catálogo completo de
 * Phosphor sin una dependencia nueva solo para esto.
 */
export const OFFER_TYPE_ICON_BY_NAME: Record<string, Icon> = {
  "fork-knife": ForkKnife,
  // Promoción pasó de 'tag' a 'percent' (migración categorias-icono-color):
  // Tag significa solo "oferta con vigencia" genérica en toda la app (ver
  // lib/icons/semantic-icons.ts). 'tag' ya no mapea a nada propio: un tipo
  // que todavía lo tuviera cae en el genérico, que es el mismo Tag.
  percent: Percent,
  package: Package,
  "calendar-star": CalendarStar,
};

export const DEFAULT_OFFER_TYPE_ICON: Icon = SEMANTIC_ICONS.offer;

/**
 * Para un lookup dentro de un callback (ej. `.map()`) — para el cuerpo
 * de un componente en sí, usar el lookup directo contra
 * `OFFER_TYPE_ICON_BY_NAME`/`DEFAULT_OFFER_TYPE_ICON` (ver
 * catalog-icons.tsx#resolveCatalogIcon, mismo criterio exacto): la regla
 * `react-hooks/static-components` marca como error asignar a una
 * variable con mayúscula inicial, usada luego como tag JSX, el
 * resultado de una LLAMADA a función en el cuerpo de un componente.
 */
export function resolveOfferTypeIcon(iconName: string | null | undefined): Icon {
  if (!iconName) return DEFAULT_OFFER_TYPE_ICON;
  return OFFER_TYPE_ICON_BY_NAME[iconName] ?? DEFAULT_OFFER_TYPE_ICON;
}
