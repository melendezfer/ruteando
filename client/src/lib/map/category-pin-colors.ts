/**
 * Color de pin por categoría (sin RF asociado — petición directa del
 * usuario): antes, todo pin del mapa era el mismo terracota de marca,
 * sin ninguna forma de distinguir a la distancia "comida rápida" de
 * "sastrería" de "droguería" sin tocar cada uno. `getCategoryPinColor`
 * asigna un color determinístico por `categoryId` (no por `Category.type`
 * — el tipo agrupa en solo 3 baldes, comida/bienes/servicios, y no
 * alcanza para distinguir categorías específicas del mismo tipo como
 * "comida rápida" vs. "restaurante"; `categoryId` sí lo hace).
 *
 * Paleta: los 8 primeros colores del orden categórico validado de la
 * skill `dataviz` de este entorno (`references/palette.md`) — validado
 * con `scripts/validate_palette.js` contra el fondo real de este
 * proyecto (`--color-background: #fafafa`, ver globals.css): las 8
 * separaciones adyacentes pasan el piso de daltonismo (ΔE CVD >= 8,
 * peor caso 9.1) y el piso de visión normal (ΔE >= 15, peor caso 19.6).
 * Coincide, de casualidad, con las 8 categorías ya sembradas hoy
 * (Arepas, Perros calientes y salchipapas, Dulces y postres, Jugos
 * naturales, Empanadas, Costura y sastrería, Servicios legales básicos,
 * Artesanías) — una categoría 9 en adelante recicla la paleta (hash
 * mod 8), no agrega un color nuevo.
 *
 * Límite reconocido, no oculto: la validación de la skill solo cubre
 * pares ADYACENTES (el caso relevante acá: dos pines que terminan cerca
 * uno del otro en el mapa) — con las 8 categorías visibles a la vez en
 * pantalla, un lector con daltonismo puede no distinguir dos categorías
 * específicas que no sean vecinas en el mapa (el propio archivo de la
 * skill documenta que el chequeo "todos contra todos" solo pasa con 3
 * colores). Sin leyenda en el mapa todavía (no se pidió) — el nombre de
 * la categoría sí queda disponible como texto en cuanto se toca un pin
 * (BusinessSummarySheet), que es la mitigación real de "nunca solo
 * color" para el caso que más importa (identificar EL negocio que se
 * tocó, no diferenciar todos los pines visibles a la vez).
 *
 * Sin variante de modo oscuro a propósito — mismo criterio que
 * `--color-background-dark` en globals.css: este proyecto todavía no
 * activa un modo oscuro real (inventar esos valores sería la misma
 * clase de suposición que ese comentario ya advierte no hacer).
 */

const CATEGORY_PIN_PALETTE = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aguamarina
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde (dataviz, distinto de --color-verde de estado "abierto")
  "#4a3aa7", // violeta
  "#e34948", // rojo (dataviz, distinto de --color-rojo de error)
] as const;

/** Mismo terracota de marca que ya usaba todo pin antes de esta funcionalidad — para un negocio sin categoría resuelta. */
export const DEFAULT_PIN_COLOR = "var(--color-terracota)";

/**
 * Hash multiplicativo determinístico (Knuth) — evita que categorías con
 * ids consecutivos (el caso real hoy, 1..8) dependan de un simple módulo
 * para verse repartidas; el mismo `categoryId` siempre resuelve al mismo
 * color, sin necesitar conocer el catálogo completo de categorías.
 */
function hashToIndex(value: number, length: number): number {
  const hashed = Math.imul(value, 2654435761) >>> 0;
  return hashed % length;
}

export function getCategoryPinColor(categoryId: number | null | undefined): string {
  if (categoryId == null || !Number.isFinite(categoryId)) return DEFAULT_PIN_COLOR;
  return CATEGORY_PIN_PALETTE[hashToIndex(categoryId, CATEGORY_PIN_PALETTE.length)];
}
