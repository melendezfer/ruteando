/**
 * Expansión de alcance (petición directa del usuario, sin RF asociado —
 * ver CLAUDE.md sección 31): RUTEANDO deja de ser exclusivamente un
 * directorio de comida callejera y admite comercio informal no
 * gastronómico. "Menú" era el único rótulo posible para la sección de
 * contenido del perfil de negocio — acá vive el mapeo de
 * `Category.type` (comida/bienes/servicios) al rótulo y al texto vacío
 * correctos, único lugar del frontend con esa correspondencia (mismo
 * criterio que review-tags.ts o hygiene.ts: un solo lugar evita que la
 * sección del perfil y cualquier otro texto que la mencione diverjan).
 *
 * La forma de los datos subyacentes (Product: nombre/descripción/precio/
 * disponible/foto) NO cambia entre los tres tipos — solo el rótulo y el
 * texto de estado vacío que envuelven la misma lista.
 */

export type CatalogType = "food" | "goods" | "services";

const CATALOG_SECTION_LABEL: Record<CatalogType, string> = {
  food: "Menú",
  goods: "Productos",
  services: "Servicios",
};

const CATALOG_EMPTY_STATE: Record<CatalogType, string> = {
  food: "Este negocio todavía no publicó su menú.",
  goods: "Este negocio todavía no publicó sus productos.",
  services: "Este negocio todavía no publicó sus servicios.",
};

const DEFAULT_SECTION_LABEL = "Catálogo";
const DEFAULT_EMPTY_STATE = "Este negocio todavía no publicó su catálogo.";

/**
 * `type` puede faltar (por ejemplo, si categoryId no resolvió ninguna
 * categoría real) — en ese caso el rótulo genérico "Catálogo" es más
 * honesto que asumir comida por defecto.
 */
export function resolveCatalogSectionLabel(type: CatalogType | null | undefined): string {
  return type ? CATALOG_SECTION_LABEL[type] : DEFAULT_SECTION_LABEL;
}

export function resolveCatalogEmptyState(type: CatalogType | null | undefined): string {
  return type ? CATALOG_EMPTY_STATE[type] : DEFAULT_EMPTY_STATE;
}

// Gestión del catálogo (agregar/editar/eliminar, sin épica asignada
// hasta ahora — petición directa del usuario): nombre singular de un
// ítem, para el botón "Agregar {X}" junto al título de la sección
// (business-profile-screen.tsx) y los textos de ProductForm/confirmación
// de borrado — mismo criterio que el resto de este archivo, un rótulo
// distinto según el tipo de categoría en vez de asumir siempre "plato".
const ITEM_NOUN: Record<CatalogType, string> = {
  food: "plato",
  goods: "producto",
  services: "servicio",
};

const DEFAULT_ITEM_NOUN = "ítem";

export function resolveItemNoun(type: CatalogType | null | undefined): string {
  return type ? ITEM_NOUN[type] : DEFAULT_ITEM_NOUN;
}
