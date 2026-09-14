import type { components } from "@/lib/api/schema";
import type { CatalogType } from "@/lib/catalog/catalog-label";

export type ReviewTag = components["schemas"]["ReviewTag"];

/**
 * Catálogo de etiquetas rápidas de retroalimentación (sin RF asociado,
 * petición directa del usuario — ver CLAUDE.md, rediseño de reseñas).
 * Único lugar del frontend que conoce las etiquetas y su texto en
 * español, mismo criterio que STATUS_BADGE en reviews-tab.tsx para
 * moderationStatus.
 *
 * **Corregido** (bug real, ver CLAUDE.md sección 31/32): nació con un
 * único catálogo fijo pensado solo para comida (hot_food, small_portion,
 * etc.) — con la expansión a comercio no gastronómico, calificar una
 * costurera o una asesoría legal seguía mostrando esas mismas etiquetas
 * de comida. Ahora el catálogo varía según `Category.type`, con el
 * mismo criterio ya establecido para el rótulo de la sección de
 * catálogo (catalog-label.ts): genéricas siempre visibles + un grupo
 * específico por tipo.
 */
export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  // Genéricas — cualquier tipo de negocio.
  good_service: "Buen trato",
  long_wait: "Esperé mucho",
  good_price: "Buen precio",
  high_price: "Precio alto",
  // Solo `food` (alimentos).
  hot_food: "Comida caliente",
  cold_food: "Comida fría",
  good_presentation: "Buena presentación",
  small_portion: "Poca cantidad",
  // Solo `goods` (productos — ej. artesanías).
  good_quality: "Buena calidad",
  poor_quality: "Mala calidad",
  not_as_described: "No era lo que esperaba",
  // Solo `services` (ej. costura/sastrería, asesoría legal básica).
  knowledgeable: "Buen asesoramiento",
  did_not_solve_problem: "No resolvió mi problema",
  punctual: "Puntual",
  late: "Impuntual",
};

const GENERIC_REVIEW_TAGS: ReviewTag[] = ["good_service", "long_wait", "good_price", "high_price"];

// El orden acá es el orden en que se muestran los chips dentro de cada
// grupo — agrupado por tema en vez de alfabético, para que sea más
// fácil de escanear al calificar. `good_presentation` se reusa en
// `goods` (aplica igual de bien al empaque/acabado de un producto que a
// un plato) — no se repite el texto, solo el id.
const REVIEW_TAGS_BY_CATALOG_TYPE: Record<CatalogType, ReviewTag[]> = {
  food: ["hot_food", "cold_food", "good_presentation", "small_portion"],
  goods: ["good_quality", "poor_quality", "good_presentation", "not_as_described"],
  services: ["knowledgeable", "did_not_solve_problem", "punctual", "late"],
};

/**
 * `catalogType` puede faltar (categoryId sin resolver, mismo caso
 * defensivo que catalog-label.ts) — en ese caso se muestran solo las
 * genéricas, nunca las de comida por default (era justo el bug que esto
 * corrige).
 */
export function resolveReviewTags(catalogType: CatalogType | null | undefined): ReviewTag[] {
  const especificas = catalogType ? REVIEW_TAGS_BY_CATALOG_TYPE[catalogType] : [];
  return [...GENERIC_REVIEW_TAGS, ...especificas];
}
