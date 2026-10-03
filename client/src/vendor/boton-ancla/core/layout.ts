import { normalizarAngulo, anguloParaMano, puntoEnDireccion, radioParaCuerda } from "./geometry";
import type { Params } from "./params";
import type { ActionKind, AnchorAction, AnchorIcon, AnchorScreen, Hand, Insets, Point, Rect } from "./types";
import { ID_ATRAS, ID_CERRAR, ID_DESHACER, ID_OCULTAR_TECLADO } from "./validate";

// Posición del ancla y geometría del abanico (design.md §4.2 y §4.3).

export type FanSlot = {
  /** 0 = extremo "arriba" … n−1 = extremo lateral. */
  index: number;
  /** Ángulo en espacio de mano derecha (ARCO_DESDE … ARCO_HASTA). */
  anguloBase: number;
  /** Ángulo real en pantalla (reflejado con la mano izquierda). */
  angulo: number;
  /** Centro de la opción en pantalla. */
  punto: Point;
  /** Sector de selección en espacio de mano derecha; los extremos incluyen EXT_EXTREMOS. */
  sector: { desde: number; hasta: number };
};

export type FanLayout = {
  /** Radio adaptativo (C-01). */
  radio: number;
  /** Radio del anillo exterior para confirmar irreversibles. */
  rExterior: number;
  slots: FanSlot[];
  /** true si alguna opción, a tamaño preseleccionado, se sale de la zona útil (RF-12). */
  fueraDePantalla: boolean;
};

type EntradaPosicion = { viewport: Rect; safeArea: Insets; hand: Hand; params: Params };

/**
 * Centro del ancla, del lado de la mano, respetando área segura y márgenes.
 *
 * Altura (HM-01): ANCLA_ALTURA × alto útil sobre el borde inferior útil, limitada a
 * - piso: no más abajo que MARGEN_INFERIOR + D_ACTIVO/2 sobre el borde inferior útil;
 * - techo: no tan arriba que la opción de 90° del abanico más grande (MAX_OPCIONES,
 *   escalada) y la banda de etiqueta encima (HM-02) se salgan por arriba del área segura.
 * Si en una pantalla diminuta los dos límites chocan, gana el piso (el ancla nunca
 * se sale) y computeFanLayout marcará fueraDePantalla.
 * Se usa D_ACTIVO (no D_REPOSO) para que al crecer no invada los márgenes.
 */
export function computeAnchorPosition({ viewport, safeArea, hand, params }: EntradaPosicion): Point {
  const distanciaLateral = params.MARGEN_LATERAL + params.D_ACTIVO / 2;
  const x =
    hand === "right"
      ? viewport.x + viewport.width - safeArea.right - distanciaLateral
      : viewport.x + safeArea.left + distanciaLateral;

  const arriba = viewport.y + safeArea.top;
  const abajo = viewport.y + viewport.height - safeArea.bottom;
  const piso = abajo - params.MARGEN_INFERIOR - params.D_ACTIVO / 2;
  const techo =
    arriba +
    params.BANDA_ALTO +
    params.BANDA_MARGEN +
    radioAdaptativo(params.MAX_OPCIONES, params) +
    (params.D_OPCION * params.ESCALA_PRESEL) / 2;
  const deseada = abajo - params.ANCLA_ALTURA * (abajo - arriba);
  const y = Math.min(piso, Math.max(techo, deseada));
  return { x, y };
}

/** Separación angular entre opciones vecinas; 0 si hay menos de 2. */
function paso(count: number, params: Params): number {
  return count < 2 ? 0 : (params.ARCO_HASTA - params.ARCO_DESDE) / (count - 1);
}

/**
 * Radio adaptativo (C-01): el mínimo R_ARCO, o más si hace falta para que
 * opciones vecinas no se encimen: max(R_ARCO, (D_OPCION + SEPARACION_MIN) / (2·sin(Δ/2))).
 */
export function radioAdaptativo(count: number, params: Params): number {
  if (count < 2) return params.R_ARCO;
  return Math.max(params.R_ARCO, radioParaCuerda(params.D_OPCION + params.SEPARACION_MIN, paso(count, params)));
}

/**
 * Ángulos base: en los extremos del arco y a intervalos iguales. Con 1 opción,
 * la diagonal, salvo que sea "Atrás" (unicaArriba): entonces arriba (C-22).
 */
function angulosBase(count: number, params: Params, unicaArriba: boolean, unicaLateral: boolean): number[] {
  if (count <= 0) return [];
  if (count === 1) {
    if (unicaArriba) return [params.ARCO_DESDE];
    if (unicaLateral) return [params.ARCO_HASTA];
    return [(params.ARCO_HASTA + params.ARCO_DESDE) / 2];
  }
  const delta = paso(count, params);
  return Array.from({ length: count }, (_, i) => params.ARCO_DESDE + i * delta);
}

type EntradaAbanico = {
  anchor: Point;
  viewport: Rect;
  safeArea: Insets;
  count: number;
  hand: Hand;
  params: Params;
  /** La opción única es "Atrás": va arriba y no en la diagonal (C-22). Sin efecto si count ≠ 1. */
  unicaArriba?: boolean;
  /** La opción única es "Ocultar teclado": va al extremo lateral (RF-17). Sin efecto si count ≠ 1. */
  unicaLateral?: boolean;
  /** Fase 3 (RF3-15): hacia dónde se abre. "abajo" es el espejo vertical del arco. */
  abreHacia?: "arriba" | "abajo";
};

/** Ángulo real en pantalla de un ángulo base: espejo horizontal con la mano izquierda y vertical si abre hacia abajo. */
export function anguloEnPantalla(anguloBase: number, hand: Hand, abreHacia: "arriba" | "abajo" = "arriba"): number {
  const a = anguloParaMano(anguloBase, hand);
  return abreHacia === "abajo" ? normalizarAngulo(-a) : a;
}

/** Lo inverso: el ángulo base (espacio de mano derecha, abanico hacia arriba) de un ángulo de pantalla. */
export function anguloBaseDe(anguloPantalla: number, hand: Hand, abreHacia: "arriba" | "abajo" = "arriba"): number {
  return anguloParaMano(abreHacia === "abajo" ? normalizarAngulo(-anguloPantalla) : anguloPantalla, hand);
}

export function computeFanLayout({
  anchor,
  viewport,
  safeArea,
  count,
  hand,
  params,
  unicaArriba = false,
  unicaLateral = false,
  abreHacia = "arriba",
}: EntradaAbanico): FanLayout {
  const radio = radioAdaptativo(count, params);
  const angulos = angulosBase(count, params, unicaArriba, unicaLateral);
  const inicio = params.ARCO_DESDE - params.EXT_EXTREMOS;
  const fin = params.ARCO_HASTA + params.EXT_EXTREMOS;

  const slots = angulos.map((anguloBase, index): FanSlot => {
    const anterior = angulos[index - 1];
    const siguiente = angulos[index + 1];
    const angulo = anguloEnPantalla(anguloBase, hand, abreHacia);
    return {
      index,
      anguloBase,
      angulo,
      punto: puntoEnDireccion(anchor, radio, angulo),
      sector: {
        // Bisectriz con la vecina; en los extremos, el borde del arco más la tolerancia.
        desde: anterior === undefined ? inicio : (anterior + anguloBase) / 2,
        hasta: siguiente === undefined ? fin : (anguloBase + siguiente) / 2,
      },
    };
  });

  return {
    radio,
    rExterior: radio + params.EXTRA_EXTERIOR,
    slots,
    fueraDePantalla: slots.some((s) => !cabeEnZonaUtil(s.punto, viewport, safeArea, params)),
  };
}

/**
 * Zona útil (RF-12): viewport menos área segura, menos MARGEN_LATERAL a los lados
 * y MARGEN_INFERIOR abajo. Arriba solo el área segura: el abanico nunca llega cerca.
 */
function cabeEnZonaUtil(centro: Point, viewport: Rect, safeArea: Insets, params: Params): boolean {
  const mitad = (params.D_OPCION * params.ESCALA_PRESEL) / 2;
  const tolerancia = 1e-6; // errores de redondeo de seno y coseno
  const izquierda = viewport.x + safeArea.left + params.MARGEN_LATERAL;
  const derecha = viewport.x + viewport.width - safeArea.right - params.MARGEN_LATERAL;
  const arriba = viewport.y + safeArea.top;
  const abajo = viewport.y + viewport.height - safeArea.bottom - params.MARGEN_INFERIOR;
  return (
    centro.x - mitad >= izquierda - tolerancia &&
    centro.x + mitad <= derecha + tolerancia &&
    centro.y - mitad >= arriba - tolerancia &&
    centro.y + mitad <= abajo + tolerancia
  );
}

// ---------------------------------------------------------------------------
// Asignación de acciones a posiciones (design.md §4.4; C-10, C-11, C-21)
// ---------------------------------------------------------------------------

/** Lo que la geometría necesita saber de cada acción. */
/**
 * `deslizador` solo aparece (en true) en las acciones con `onSlide` (RF-20); `arriba`, en la
 * acción `atTop` de una pantalla sin "Atrás" (RF-22).
 */
export type OrderedAction = { id: string; kind: ActionKind; disabled: boolean; deslizador?: true; arriba?: true; mover?: true };

/** Una posición del abanico con su acción asignada. */
export type Slot = FanSlot & OrderedAction;

const ATRAS: OrderedAction = { id: ID_ATRAS, kind: "normal", disabled: false };
const DESHACER: OrderedAction = { id: ID_DESHACER, kind: "normal", disabled: false };
const CERRAR: OrderedAction = { id: ID_CERRAR, kind: "normal", disabled: false };
const OCULTAR_TECLADO: OrderedAction = { id: ID_OCULTAR_TECLADO, kind: "normal", disabled: false };

/** Opciones fijas que van siempre arriba (90°): "Atrás" y, con una capa abierta, "Cerrar". */
const FIJAS_ARRIBA = [ID_ATRAS, ID_CERRAR];

/**
 * Ordena las acciones de una pantalla: "Atrás" primero (si existe) y después
 * por priority ascendente; sin priority, al final en orden de declaración.
 * Con `deshacer`, "Deshacer" reemplaza a la acción de prioridad 1 (C-21).
 */
export function orderActions(screen: AnchorScreen, opciones: { deshacer?: boolean } = {}): OrderedAction[] {
  const propias = screen.actions
    .map((accion, orden) => ({ accion, orden }))
    .sort(
      (a, b) =>
        (a.accion.priority ?? Number.POSITIVE_INFINITY) - (b.accion.priority ?? Number.POSITIVE_INFINITY) ||
        a.orden - b.orden, // Infinity − Infinity = NaN (falso): desempata por orden de declaración
    )
    .map(({ accion }): OrderedAction => ({
      id: accion.id,
      kind: accion.kind ?? "normal",
      disabled: accion.disabled ?? false,
      ...(accion.onSlide ? { deslizador: true as const } : {}),
      // RF-22: sin "Atrás", la acción inofensiva marcada va a 90°.
      ...(accion.atTop && !screen.back ? { arriba: true as const } : {}),
      // Fase 3 (RF3-01): "Mover ancla" se ajusta quedándose quieto, como un deslizador.
      ...(accion.moveAnchor ? { mover: true as const } : {}),
    }));

  if (opciones.deshacer) {
    if (propias.length === 0) propias.push(DESHACER);
    else propias[0] = DESHACER;
  }

  return screen.back ? [ATRAS, ...propias] : propias;
}

/**
 * Pone una acción en cada posición: "Atrás" en el extremo "arriba" (D-10) y el
 * resto por cercanía a la diagonal, desempatando según params.DESEMPATE (C-10).
 * Devuelve las posiciones en orden de index.
 */
export function assignActions(layout: FanLayout, ordered: OrderedAction[], params: Params): Slot[] {
  if (ordered.length !== layout.slots.length) {
    throw new Error(
      `assignActions: hay ${ordered.length} acciones para ${layout.slots.length} posiciones; ` +
        "computeFanLayout debe recibir count = orderActions(...).length.",
    );
  }

  let libres = [...layout.slots];
  let pendientes = ordered;
  const asignadas: Slot[] = [];

  // 90° es de la familia "volver" (D-10); sin ella, de la acción inofensiva `atTop` (RF-22).
  const atras = ordered.find((a) => FIJAS_ARRIBA.includes(a.id)) ?? ordered.find((a) => a.arriba);
  if (atras) {
    // El extremo "arriba" es la posición de menor ángulo base (index 0).
    const arriba = libres.reduce((min, s) => (s.anguloBase < min.anguloBase ? s : min));
    asignadas.push({ ...arriba, ...atras });
    libres = libres.filter((s) => s !== arriba);
    pendientes = pendientes.filter((a) => a !== atras);
  }

  // RF-17: "Ocultar teclado" va siempre al extremo lateral (mayor ángulo base).
  const ocultar = pendientes.find((a) => a.id === ID_OCULTAR_TECLADO);
  if (ocultar && libres.length > 0) {
    const lateral = libres.reduce((max, s) => (s.anguloBase > max.anguloBase ? s : max));
    asignadas.push({ ...lateral, ...ocultar });
    libres = libres.filter((s) => s !== lateral);
    pendientes = pendientes.filter((a) => a !== ocultar);
  }

  const diagonal = (params.ARCO_DESDE + params.ARCO_HASTA) / 2;
  const porComodidad = libres.sort((a, b) => {
    const diferencia = Math.abs(a.anguloBase - diagonal) - Math.abs(b.anguloBase - diagonal);
    if (Math.abs(diferencia) > 1e-9) return diferencia;
    // Empate: "horizontal" prefiere el ángulo mayor (hacia el extremo lateral).
    return params.DESEMPATE === "horizontal" ? b.anguloBase - a.anguloBase : a.anguloBase - b.anguloBase;
  });

  pendientes.forEach((accion, i) => {
    asignadas.push({ ...porComodidad[i]!, ...accion });
  });

  return asignadas.sort((a, b) => a.index - b.index);
}

type EntradaPantalla = {
  screen: AnchorScreen;
  viewport: Rect;
  safeArea: Insets;
  hand: Hand;
  params: Params;
  /** Hay un aviso de deshacer vivo (C-21). */
  deshacer?: boolean;
  /** Hay una capa abierta encima del contenido (HM-03): "Cerrar" va a 90°. */
  capa?: boolean;
  /** Hay un teclado virtual abierto (RF-17): "Ocultar teclado" va a 180°. */
  teclado?: boolean;
  /** Fase 3: el centro del ancla ya resuelto (resolverColocacion). Sin él, el de la Fase 1. */
  ancla?: Point;
  /** Fase 3 (RF3-15): hacia dónde se abre el abanico. */
  abreHacia?: "arriba" | "abajo";
};

/**
 * Atajo para el adaptador: ordena las acciones, calcula el ancla y el abanico
 * (con unicaArriba cuando la única opción es "Atrás", C-22) y asigna cada acción.
 */
export function layoutParaPantalla({
  screen,
  viewport,
  safeArea,
  hand,
  params,
  deshacer = false,
  capa = false,
  teclado = false,
  ancla,
  abreHacia = "arriba",
}: EntradaPantalla): {
  anchor: Point;
  layout: FanLayout;
  ordered: OrderedAction[];
  slots: Slot[];
} {
  let ordered = orderActions(screen, { deshacer });
  // HM-03, casos borde: sin opciones, "Cerrar" va sola arriba; con una única acción que no
  // es "Atrás" (esa va en la diagonal), "Cerrar" se agrega arriba y la acción pasa al extremo.
  const agregarCerrar = capa && (ordered.length === 0 || (ordered.length === 1 && ordered[0]!.id !== ID_ATRAS));
  if (agregarCerrar) ordered = [CERRAR, ...ordered];
  // RF-17: con teclado, "Ocultar teclado" se AGREGA fijo al extremo lateral (como "Atrás"
  // arriba). Si así pasara de MAX_OPCIONES, sale la acción de menor prioridad (la última).
  if (teclado) {
    if (ordered.length >= params.MAX_OPCIONES) ordered = ordered.slice(0, params.MAX_OPCIONES - 1);
    ordered = [...ordered, OCULTAR_TECLADO];
  }
  const anchor = ancla ?? computeAnchorPosition({ viewport, safeArea, hand, params });
  const layout = computeFanLayout({
    abreHacia,
    anchor,
    viewport,
    safeArea,
    count: ordered.length,
    hand,
    params,
    unicaArriba: ordered.length === 1 && FIJAS_ARRIBA.includes(ordered[0]!.id),
    unicaLateral: ordered.length === 1 && ordered[0]!.id === ID_OCULTAR_TECLADO,
  });
  let slots = assignActions(layout, ordered, params);
  // HM-03: "Cerrar" REEMPLAZA lo que esté a 90° ("Atrás" o la opción de arriba) y nada más se
  // mueve, igual que "Deshacer" (C-21). El total no cambia: nunca pasa de MAX_OPCIONES.
  if (capa && !agregarCerrar) {
    slots = slots.map((s) => (s.index === 0 ? { ...s, ...CERRAR } : s));
  }
  return { anchor, layout, ordered, slots };
}

/** Lo que una capa declara (HM-08, spec RF-15). */
export type CapaAncla = {
  icon?: AnchorIcon;
  label?: string;
  /** Máximo MAX_OPCIONES − 1: "Cerrar" ocupa una posición. */
  actions?: AnchorAction[];
};

/**
 * Pantalla que se ve mientras hay una capa abierta (HM-08): el ícono y el nombre de la
 * capa (o los del fondo, si no los declara), sus acciones, y un "Atrás" que la regla de
 * HM-03 convierte en "Cerrar" a 90° (usar con `capa: true`). Las acciones del fondo no
 * están: vuelven al cerrar la capa, en sus mismas posiciones.
 */
export function pantallaDeCapa(fondo: AnchorScreen, capa: CapaAncla): AnchorScreen {
  return {
    id: `${fondo.id}›${capa.label ?? "capa"}`,
    sectionIcon: capa.icon ?? fondo.sectionIcon,
    sectionLabel: capa.label ?? fondo.sectionLabel,
    back: { onSelect: () => {} }, // lo ejecuta "Cerrar", no este onSelect
    actions: capa.actions ?? [],
  };
}
