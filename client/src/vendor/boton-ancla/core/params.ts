// Parámetros iniciales, ajustables con las pruebas (spec §6, v0.2).
// Los nombres son los mismos de la spec para poder rastrearlos.
// Las distancias van en px, los tiempos en ms y los ángulos en grados.

export type Params = {
  /** Diámetro del ancla en reposo. */
  D_REPOSO: number;
  /** Diámetro del ancla activa. */
  D_ACTIVO: number;
  /** Diámetro de cada opción (mínimo táctil). */
  D_OPCION: number;
  /** Escala de la opción preseleccionada. */
  ESCALA_PRESEL: number;
  /** Opacidad del fondo del ancla en reposo (0–1); el ícono siempre al 100 %. */
  OPACIDAD_REPOSO: number;
  /** Distancia al borde lateral, además del área segura (L-02). */
  MARGEN_LATERAL: number;
  /** Distancia MÍNIMA al borde inferior, además del área segura (piso del ancla). */
  MARGEN_INFERIOR: number;
  /**
   * Altura del centro del ancla sobre el borde inferior útil, como fracción del
   * alto útil (alto visible menos áreas seguras). 0 = lo más abajo posible.
   * Queda limitada para que el abanico quepa (HM-01).
   */
  ANCLA_ALTURA: number;
  /** Alto de la banda de etiqueta encima del abanico (HM-02). */
  BANDA_ALTO: number;
  /** Espacio entre la opción de más arriba y la banda de etiqueta (HM-02). */
  BANDA_MARGEN: number;
  /** Radio de la zona muerta. */
  R_MUERTA: number;
  /** Radio MÍNIMO del arco; el real se adapta al número de opciones (C-01). */
  R_ARCO: number;
  /** Espacio mínimo entre opciones vecinas a tamaño normal (C-01). */
  SEPARACION_MIN: number;
  /** R_EXTERIOR = radio adaptativo + EXTRA_EXTERIOR. */
  EXTRA_EXTERIOR: number;
  /** Inicio del arco para la mano derecha (90° = arriba). */
  ARCO_DESDE: number;
  /** Fin del arco para la mano derecha (180° = izquierda). La izquierda se refleja. */
  ARCO_HASTA: number;
  /** Tolerancia de los sectores extremos fuera del arco. */
  EXT_EXTREMOS: number;
  /** Grados extra que hay que pasar para cambiar de preselección. */
  HISTERESIS: number;
  /** Movimiento que distingue un toque de un gesto. */
  UMBRAL_MOV: number;
  /** Duración máxima de un toque. */
  T_TOQUE: number;
  /** Tiempo quieto para entrar en descanso. */
  T_DESCANSO: number;
  /** Cierre automático del modo toque. */
  T_INACTIVO: number;
  /** Duración del aviso con deshacer. */
  T_DESHACER: number;
  /** Duración de la animación de apertura y cierre. */
  T_ANIM: number;
  /** Duración de la vibración (solo Android). */
  VIB_MS: number;
  /** Usos en los que cada opción muestra su etiqueta (bienvenida). */
  USOS_ETIQUETA: number;
  /** Máximo de opciones, contando "Atrás". */
  MAX_OPCIONES: number;
  /** Si dos posiciones quedan igual de cerca de la diagonal, cuál gana (C-10). */
  DESEMPATE: Desempate;
  /** HM-09: direcciones (mano derecha; se reflejan) que activan el modo desplazamiento. */
  ARCO_DESPLAZAR_DESDE: number;
  ARCO_DESPLAZAR_HASTA: number;
  /** HM-09: zona muerta vertical alrededor del punto donde empezó el modo. */
  R_MUERTA_DESPLAZAR: number;
  /** HM-09: distancia vertical a la que se alcanza la velocidad máxima. */
  R_MAX_DESPLAZAR: number;
  /** HM-09: velocidad máxima, en px/s. */
  V_MAX_DESPLAZAR: number;
  /** HM-09: exponente de la curva (más alto = más lento cerca del centro). */
  CURVA_DESPLAZAR: number;
  /** HM-09: velocidad máxima con prefers-reduced-motion, en px/s. */
  V_MAX_REDUCIDO: number;
  /** Variante "arriba" de la guía (HM-10): corrimiento de la cápsula hacia el centro, en px. */
  GUIA_CORRIMIENTO: number;
  /** Variante "arriba" (HM-10): espacio sobre el punto más alto que alcanza el pulgar, en px. */
  GUIA_SEPARACION: number;
  /** RF-20 (HM-12a): tiempo sobre una opción deslizador para pasar a ajustarla, en ms. */
  T_ESPERA_DESLIZADOR: number;
  /** RF-21 (HM-12a): radio del imán de un pin alrededor de la mira, en px. */
  IMAN_RADIO: number;
  /** RF-21: radio mínimo del imán con pines vecinos cerca, en px. */
  IMAN_RADIO_MIN: number;
  /** HM-15: espera antes de que empiece el centrado (mira del mapa y foco de las listas), en ms. */
  T_ESPERA_CENTRADO: number;
  /** HM-15: duración del centrado (salida suave), en ms. Con movimiento reducido, instantáneo. */
  T_CENTRADO: number;
  /** RF-21: factor de velocidad del joystick con algo en la mira. */
  FRENO_APUNTAR: number;
  /** RF-21: pines más cerca que esto (px en pantalla) forman un grupo. */
  GRUPO_DISTANCIA: number;
  /** RF-21: mira quieta sobre un grupo antes del zoom automático, en ms. */
  T_ZOOM_GRUPO: number;
  /** RF-23 (HM-12b): pulgar hacia el centro para pasar de desplazar a apuntar en una lista, en px. */
  UMBRAL_APUNTAR: number;
  /** RF-23: margen para volver a desplazar, en px. */
  HISTERESIS_APUNTAR: number;
  /** RF-23: pulgar vertical por cada elemento al apuntar en una lista, en px. */
  PASO_APUNTAR: number;
  /** Fase 3 (RF3-10): espacio mínimo entre lo que dibuja el ancla y una zona reservada, en px. */
  MARGEN_ZONA: number;
  /** Fase 3 (DF3-05): altura de inicio del ancla en horizontal (fracción del alto útil). */
  ANCLA_ALTURA_H: number;
};

/** "horizontal" = gana la más cercana al extremo lateral; "vertical" = la más cercana a "arriba". */
export type Desempate = "horizontal" | "vertical";

export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze({
  D_REPOSO: 52,
  D_ACTIVO: 64,
  D_OPCION: 44,
  ESCALA_PRESEL: 1.25,
  OPACIDAD_REPOSO: 0.6,
  MARGEN_LATERAL: 24,
  MARGEN_INFERIOR: 16,
  ANCLA_ALTURA: 0.44,
  BANDA_ALTO: 28,
  BANDA_MARGEN: 8,
  R_MUERTA: 24,
  R_ARCO: 100,
  SEPARACION_MIN: 0,
  EXTRA_EXTERIOR: 48,
  ARCO_DESDE: 90,
  ARCO_HASTA: 180,
  EXT_EXTREMOS: 20,
  HISTERESIS: 8,
  UMBRAL_MOV: 10,
  T_TOQUE: 250,
  T_DESCANSO: 400,
  T_INACTIVO: 4000,
  T_DESHACER: 5000,
  T_ANIM: 140,
  VIB_MS: 10,
  USOS_ETIQUETA: 5,
  MAX_OPCIONES: 5,
  DESEMPATE: "horizontal",
  ARCO_DESPLAZAR_DESDE: 210,
  ARCO_DESPLAZAR_HASTA: 330,
  R_MUERTA_DESPLAZAR: 8,
  R_MAX_DESPLAZAR: 72,
  V_MAX_DESPLAZAR: 1400,
  CURVA_DESPLAZAR: 2.2,
  V_MAX_REDUCIDO: 500,
  GUIA_CORRIMIENTO: 16,
  GUIA_SEPARACION: 24,
  T_ESPERA_DESLIZADOR: 300,
  IMAN_RADIO: 28,
  IMAN_RADIO_MIN: 12,
  T_ESPERA_CENTRADO: 0,
  T_CENTRADO: 100,
  FRENO_APUNTAR: 0.35,
  GRUPO_DISTANCIA: 24,
  T_ZOOM_GRUPO: 500,
  UMBRAL_APUNTAR: 32,
  HISTERESIS_APUNTAR: 12,
  PASO_APUNTAR: 28,
  MARGEN_ZONA: 8,
  ANCLA_ALTURA_H: 0.3,
});
