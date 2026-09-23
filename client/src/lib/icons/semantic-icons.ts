import type { Icon } from "@phosphor-icons/react";
import {
  BookOpen,
  Broadcast,
  CheckCircle,
  DoorOpen,
  SealCheck,
  ShoppingCartSimple,
  Storefront,
  Tag,
  TextAa,
  Umbrella,
} from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";

/**
 * Registro ÚNICO de "qué significa cada ícono" en la app (rehacer íconos/
 * colores/modalidad, PR 1 de 3 — sin RF asociado). Antes, el mismo ícono
 * significaba cosas distintas según la pantalla (Tag = promoción / oferta
 * genérica / "coincidió por un producto"; Package = bienes y Combo;
 * Storefront = categoría sin resolver / "coincidió por el nombre" / local
 * fijo; CheckCircle = "Disponibles ahora" y "confirmó que vende").
 *
 * Regla: cada ícono de esta tabla representa UNA sola cosa en toda la
 * app. Antes de usar uno de estos íconos para algo nuevo, agregar el
 * significado acá — si ya está tomado por otro significado, elegir otro
 * ícono. Los íconos de CATEGORÍA (`Category.icon`, guardados en la base)
 * y de TIPO DE OFERTA (`OfferType.icon`) tienen sus propios mapas y no
 * deben reusar ninguno de estos.
 */
export const SEMANTIC_ICONS = {
  /** Oferta con vigencia, genérica (insignia en el catálogo, pestaña "Cerca de ti ahora", tipo de oferta desconocido). Promoción usa su propio ícono (Percent). */
  offer: Tag,
  /** El catálogo permanente del negocio ("Carta"/Productos/Servicios) — ej. "coincidió por un ítem de su carta". Package queda solo para el tipo de oferta Combo. */
  catalog: BookOpen,
  /** "Coincidió por el nombre del negocio" en los resultados de búsqueda. */
  businessName: TextAa,
  /** Negocio abierto ahora según su horario declarado (pestaña "Disponibles ahora"). */
  openNow: DoorOpen,
  /** El vendedor CONFIRMÓ que está vendiendo (confirmación de disponibilidad en tiempo real). Distinto de "abierto" (horario declarado). */
  confirmedSelling: SealCheck,
  /** Ubicación en vivo del vendedor ambulante (interruptor, consentimiento). */
  liveLocation: Broadcast,
  /** Acción completada con éxito (formularios, pasos de un asistente, ajustes guardados). */
  success: CheckCircle,
} satisfies Record<string, Icon>;

type Mobility = NonNullable<components["schemas"]["Business"]["mobility"]>;

/**
 * Modalidad del negocio — la marca pequeña del pin (PR 2) y el
 * interruptor del perfil usan ESTOS íconos, nunca un dibujo propio. Storefront
 * significa solo "local fijo" en toda la app.
 */
export const MOBILITY_ICONS: Record<Mobility, Icon> = {
  itinerant: ShoppingCartSimple,
  street_stall: Umbrella,
  fixed: Storefront,
};

export const MOBILITY_LABELS: Record<Mobility, string> = {
  itinerant: "Ambulante",
  street_stall: "Puesto en la calle",
  fixed: "Local",
};
