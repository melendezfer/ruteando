import type { components } from "@/lib/api/schema";

export type ReviewTag = components["schemas"]["ReviewTag"];

/**
 * Catálogo fijo y corto de etiquetas rápidas de retroalimentación (sin RF
 * asociado, petición directa del usuario — ver CLAUDE.md, rediseño de
 * reseñas). Un solo lugar en el frontend que conoce las etiquetas y su
 * texto en español, mismo criterio que STATUS_BADGE en reviews-tab.tsx
 * para moderationStatus. El orden acá es el orden en que se muestran los
 * chips — agrupado por tema (comida, trato/espera, precio, presentación)
 * en vez de alfabético, para que sea más fácil de escanear al calificar.
 */
export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  hot_food: "Comida caliente",
  cold_food: "Comida fría",
  good_service: "Buen trato",
  long_wait: "Esperé mucho",
  good_price: "Buen precio",
  high_price: "Precio alto",
  good_presentation: "Buena presentación",
  small_portion: "Poca cantidad",
};

export const REVIEW_TAGS: ReviewTag[] = Object.keys(REVIEW_TAG_LABELS) as ReviewTag[];
