import type { AnchorPrefs, MetricEvent, Params, PrefsAncla } from "@boton-ancla/core";
import type { ComponentType, ReactNode } from "react";

/** Un ícono como componente (compatible con los de Phosphor). */
export type ReactAnchorIcon = ComponentType<{
  size?: number | string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

/**
 * Colores de la app (D-19): el componente no trae colores fijos.
 * Cualquier valor CSS sirve, por ejemplo "var(--color-terracota)".
 */
export type AnchorTheme = {
  accent: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  /** Debe ser mayor que el de las hojas inferiores de la app (RF-14). Por defecto 1100. */
  zIndex?: number;
};

/**
 * Íconos de las opciones fijas que agrega el ancla. Los pone la app porque los
 * íconos se registran en la app (RNF-09). No están en AnchorScreen (spec §7).
 */
export type AnchorIcons = {
  /** Opción fija "Atrás" (D-10). */
  back: ReactAnchorIcon;
  /** Opción temporal "Deshacer" (C-21). */
  undo: ReactAnchorIcon;
  /** Opción temporal "Cerrar" mientras hay una capa abierta (HM-03). */
  close: ReactAnchorIcon;
  /** Opción "Ocultar teclado" con un teclado virtual abierto (HM-06, RF-17). */
  hideKeyboard: ReactAnchorIcon;
  /** Flechas del ancla al desplazar (HM-10, variante "ancla"). Si faltan, se usan unas propias. */
  scrollUp?: ReactAnchorIcon;
  scrollDown?: ReactAnchorIcon;
};

/** HM-12b (RF-23): un elemento de una lista que se puede apuntar (su fila en el DOM). */
export type ElementoApuntable = { id: string; el: HTMLElement; label: string; icon?: ReactAnchorIcon };

/** HM-12b (RF-23): lo que una lista ofrece para apuntar y elegir. */
export type OpcionesApuntarLista = {
  /** Los elementos en orden, con su fila (se piden cuadro a cuadro mientras se apunta). */
  elementos: () => ElementoApuntable[];
  /** Soltar en "apuntar" con este elemento en foco: abrir su capa encima de la lista. */
  elegir: (id: string) => void;
};

/** HM-10: dónde se ve la guía al desplazar. "ancla" = flecha y anillo en el propio ancla; "arriba" = cápsula arriba del ancla. */
export type GuiaDesplazar = "ancla" | "arriba";

export type AnchorProviderProps = {
  prefs: AnchorPrefs;
  theme: AnchorTheme;
  icons: AnchorIcons;
  /** Métricas locales (spec §9). */
  onEvent?: (evento: MetricEvent) => void;
  /** Ajustes de parámetros para las pruebas (por ejemplo ANCLA_ALTURA, HM-01). */
  params?: Partial<Params>;
  /** HM-09 (experimental): desplazar el contenido con el ancla. Por defecto false. */
  desplazar?: boolean;
  /**
   * Fase 3 (RF3-06): dónde queda el ancla en cada orientación. Si la app no la pasa, el ancla la
   * guarda por su cuenta a partir de `prefs.hand` (compatibilidad con la Fase 1).
   */
  placement?: PrefsAncla;
  /** Fase 3: la persona movió el ancla (o cambió de mano): la app la guarda. */
  onPlacementChange?: (placement: PrefsAncla) => void;
  /** HM-11 (experimental): joystick libre para el mapa registrado con useAnchorPan. Por defecto false. */
  desplazarLibre?: boolean;
  /** HM-12a (experimental): apuntar y elegir en el mapa (RF-21). Por defecto false. */
  apuntar?: boolean;
  /** HM-10: variante de la guía al desplazar. Por defecto "ancla". */
  guiaDesplazar?: GuiaDesplazar;
  children: ReactNode;
};
