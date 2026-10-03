// Tipos públicos del núcleo (spec §7 y design.md §2).

/** Punto en coordenadas de pantalla (px, y crece hacia abajo). */
export type Point = { x: number; y: number };

/** Rectángulo en px, por ejemplo el viewport. */
export type Rect = { x: number; y: number; width: number; height: number };

/** Márgenes en px, por ejemplo el área segura (`env(safe-area-inset-*)`). */
export type Insets = { top: number; right: number; bottom: number; left: number };

/** Mano con la que se usa el ancla: decide si va abajo a la derecha o a la izquierda (HU-11). */
export type Hand = "right" | "left";

/** Tipo de acción según su riesgo (D-14). */
export type ActionKind = "normal" | "reversible" | "irreversible";

/** El núcleo no sabe dibujar íconos: el adaptador decide qué es (en RUTEANDO, un componente de Phosphor). */
export type AnchorIcon = unknown;

export type AnchorAction = {
  id: string;
  icon: AnchorIcon;
  /** Etiqueta visible y nombre accesible (RNF-05). */
  label: string;
  onSelect: () => void | Promise<void>;
  /** 1 = posición más cómoda (la diagonal). */
  priority?: number;
  /** Por defecto "normal". */
  kind?: ActionKind;
  /** Obligatorio si kind = "reversible"; lo comprueba validateScreen (C-13). */
  onUndo?: () => void;
  /** Texto del aviso, por ejemplo "Marcado no disponible". */
  undoMessage?: string;
  disabled?: boolean;
  /**
   * RF-20 (HM-12a): la opción es un deslizador (p. ej. Zoom). Quedarse sobre ella
   * T_ESPERA_DESLIZADOR la ajusta: se llama cuadro a cuadro con `paso` (px/s × s de la curva
   * de RF-18; positivo = pulgar arriba = más). Soltar sin esperar llama `onSelect`, como
   * cualquier opción (HM-17).
   */
  onSlide?: (paso: number) => void;
  /**
   * Fase 3 (RF3-01, DF3-01): la opción "Mover ancla". Quedarse quieto sobre ella
   * T_ESPERA_DESLIZADOR entra al modo edición (el ancla se engancha al pulgar); soltar sin
   * esperar llama `onSelect` (la app entra al modo edición con su botón, useAnchorMove).
   */
  moveAnchor?: boolean;
  /**
   * RF-22 (HM-14): acción inofensiva que ocupa 90° cuando la pantalla no tiene "Atrás"
   * (90° es de la familia "volver"). Con "Atrás" o con una capa abierta no cambia nada.
   */
  atTop?: boolean;
};

export type AnchorScreen = {
  /** Identifica la sección, por ejemplo "mapa" o "perfil-negocio". Cambiarlo cancela la interacción (RF-10). */
  id: string;
  /** Lo que muestra el centro del ancla (D-09). */
  sectionIcon: AnchorIcon;
  sectionLabel: string;
  /** Si existe, habilita la opción fija "Atrás" en el extremo "arriba" del arco (D-10). */
  back?: { onSelect: () => void };
  /** Máximo MAX_OPCIONES en Fase 1, contando "Atrás". */
  actions: AnchorAction[];
};

export type AnchorPrefs = { hand: Hand };
