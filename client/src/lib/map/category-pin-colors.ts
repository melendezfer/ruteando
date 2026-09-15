import type { CatalogType } from "@/lib/catalog/catalog-label";

/**
 * Color de pin por categoría (sin RF asociado — petición directa del
 * usuario): antes, todo pin del mapa era el mismo terracota de marca,
 * sin ninguna forma de distinguir a la distancia "comida rápida" de
 * "sastrería" de "droguería" sin tocar cada uno.
 *
 * **Ajuste sobre la versión anterior** (petición directa del usuario,
 * misma rama): la primera versión hasheaba `categoryId` sobre una
 * paleta plana de 8 colores, sin relación con el tipo de negocio. Ahora
 * el color se agrupa primero por `Category.type` (mismo `CatalogType`
 * de `catalog-label.ts` — food/goods/services) en tres FAMILIAS
 * perceptuales (cálidos = alimentos, azul/morado = servicios, verde =
 * productos), y dentro de cada familia se hashea `categoryId` para dar
 * un tono distinto a cada categoría de ese mismo tipo — así "Arepas" y
 * "Costura y sastrería" se distinguen de un vistazo por FAMILIA (tipo
 * de negocio) y "Arepas" vs. "Perros calientes" se distinguen por TONO
 * dentro de la misma familia.
 *
 * **Paleta, reconstruida para este agrupamiento** (no reutiliza tal
 * cual la paleta plana de 8 colores de la versión anterior — ver el
 * hallazgo más abajo sobre por qué) — validada con la skill `dataviz`
 * de este entorno, `scripts/validate_palette.js`, contra el fondo real
 * del proyecto (`--color-background: #fafafa`):
 *
 * - Cálidos (`food`): `#d9a300` dorado, `#932525` vino, `#d24b4b` coral.
 * - Azul/morado (`services`): `#2a78d6` azul, `#4a3aa7` violeta.
 * - Verde (`goods`): `#1baf7a` verde agua, `#008300` verde.
 *
 * Validado con `--pairs all` (no solo `--pairs` adyacente) — el modo
 * que la propia skill pide para mapas/scatter ("cualquier par de
 * marcas puede terminar lado a lado"), más estricto que lo que usó la
 * versión anterior de este archivo. Las 7 tonalidades juntas
 * (`d9a300,932525,d24b4b,2a78d6,4a3aa7,1baf7a,008300`) pasan las
 * cuatro comprobaciones medibles: banda de luminosidad, piso de croma,
 * separación CVD (un WARN puntual, ver abajo) y el piso de visión
 * normal (ΔE >= 15, peor caso real 15.6 entre `#008300` y `#1baf7a`) —
 * scripts/validate_palette.js "d9a300,932525,d24b4b,2a78d6,4a3aa7,1baf7a,008300"
 * --mode light --surface "#fafafa" --pairs all.
 *
 * **Hallazgo real al construir esto, no obvio de antemano**: la paleta
 * plana de 8 colores de la versión anterior de este archivo (que
 * incluía naranja/amarillo/rojo/magenta como "cálidos" implícitos) NO
 * sirve para agruparse en una familia cálida real — validado y
 * confirmado con el mismo script: naranja+amarillo+rojo+magenta juntos
 * fallan incluso el chequeo de ADYACENTES (`#e34948`↔`#eb6834` ΔE 7.1,
 * bajo el piso duro de 15 — un FAIL real, no un WARN salvable con
 * mitigación) sin importar el orden en que se acomoden, porque los
 * cuatro caen en una banda de matiz (hue) demasiado angosta. La
 * separación tuvo que venir de variar luminosidad/saturación bastante
 * más agresivamente dentro de la familia (`#d9a300` claro vs. `#932525`
 * oscuro), no solo del matiz — encontrado con una búsqueda por fuerza
 * bruta sobre un grid de HSL (`greedySearch`, script de verificación
 * de esta rama, no committeado) que probó cientos de combinaciones
 * cálidas contra el validador real hasta encontrar un trío que sí pasa
 * `--pairs all` — un cuarto tono cálido dentro de un rango de matiz
 * inequívocamente "cálido" (0°-48°, para no invadir el verde de
 * "productos") **no existe** que pase junto a los otros tres — se
 * intentó explícitamente y la búsqueda no encontró ninguno; por eso la
 * familia cálida queda en 3 tonos, no 4, aunque hoy ya haya 5
 * categorías de tipo `food` sembradas (recicla la paleta, hash mod 3 —
 * mismo criterio ya documentado en la versión anterior de este
 * archivo, no oculto).
 *
 * **Límite reconocido, no oculto**: el único WARN real de la
 * validación (no un FAIL) es la separación CVD entre `#1baf7a`
 * (verde agua, familia productos) y `#d24b4b` (coral, familia
 * alimentos) — ΔE 7.5, dentro de la banda 6-8 "legal solo con
 * codificación secundaria". Esa codificación secundaria ya existe:
 * tocar cualquier pin muestra el nombre del negocio y su categoría
 * como texto (`BusinessSummarySheet`), lo mismo que ya mitigaba este
 * límite en la versión anterior del archivo.
 *
 * Sin variante de modo oscuro a propósito — mismo criterio que
 * `--color-background-dark` en globals.css: este proyecto todavía no
 * activa un modo oscuro real.
 */

const FAMILY_PALETTE: Record<CatalogType, readonly string[]> = {
  food: ["#d9a300", "#932525", "#d24b4b"],
  services: ["#2a78d6", "#4a3aa7"],
  goods: ["#1baf7a", "#008300"],
};

/** Mismo terracota de marca que ya usaba todo pin antes de esta funcionalidad — para un negocio sin categoría/tipo resuelto (categorías todavía sin cargar, o `categoryId` que no matchea ninguna). */
export const DEFAULT_PIN_COLOR = "var(--color-terracota)";

/**
 * Hash multiplicativo determinístico (Knuth) — el mismo `categoryId`
 * siempre resuelve al mismo tono dentro de su familia, sin depender de
 * que los ids de esa familia sean consecutivos.
 */
function hashToIndex(value: number, length: number): number {
  const hashed = Math.imul(value, 2654435761) >>> 0;
  return hashed % length;
}

export function getCategoryPinColor(
  categoryId: number | null | undefined,
  categoryType: CatalogType | null | undefined,
): string {
  if (categoryId == null || !Number.isFinite(categoryId) || !categoryType) return DEFAULT_PIN_COLOR;
  const family = FAMILY_PALETTE[categoryType];
  return family[hashToIndex(categoryId, family.length)];
}
