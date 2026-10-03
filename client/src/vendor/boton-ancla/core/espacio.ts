import { radioAdaptativo } from "./layout";
import type { Params } from "./params";
import type { Hand, Insets, Point, Rect } from "./types";

// Fase 3 (adaptación al espacio): dónde queda el ancla. Funciones puras, sin DOM (D-18);
// el adaptador mide la vista, las áreas seguras, el teclado y las zonas, y dibuja.

/** Vertical u horizontal (ancho > alto). Cada una recuerda su propia colocación (RF3-06). */
export type Orientacion = "vertical" | "horizontal";

/** Costado del ancla. La mano se deduce de él (H13): "left" = mano izquierda. */
export type Lado = Hand;

/** Dónde queda el ancla en una orientación: costado y altura (fracción del alto útil, como ANCLA_ALTURA). */
export type Colocacion = { lado: Lado; altura: number };

/** Colocaciones guardadas por orientación. Sin la horizontal, se deduce de la vertical (RF3-08). */
export type PrefsAncla = { vertical: Colocacion; horizontal?: Colocacion };

/**
 * Zona reservada (RF3-10, RF3-13): un rectángulo de la vista que el ancla, su abanico, la banda
 * y los avisos no deben tapar. Las obligatorias nunca se tapan; las preferidas, solo si no hay lugar.
 */
export type Zona = { rect: Rect; prioridad: "obligatoria" | "preferida" };

/** Compatibilidad con la Fase 1 (`AnchorPrefs = { hand }`): la mano es el costado vertical, a la altura de inicio. */
export function prefsDesdeMano(hand: Hand, params: Params): PrefsAncla {
  return { vertical: { lado: hand, altura: params.ANCLA_ALTURA } };
}

/**
 * La colocación de una orientación (RF3-06, RF3-08). La primera vez en horizontal usa el costado
 * de la vertical y la altura de inicio horizontal (ANCLA_ALTURA_H).
 */
export function colocacionPara(prefs: PrefsAncla, orientacion: Orientacion, params: Params): Colocacion {
  if (orientacion === "vertical") return prefs.vertical;
  return prefs.horizontal ?? { lado: prefs.vertical.lado, altura: params.ANCLA_ALTURA_H };
}

/** La orientación de una vista: horizontal si es más ancha que alta. */
export function orientacionDe(ancho: number, alto: number): Orientacion {
  return ancho > alto ? "horizontal" : "vertical";
}

// ---------------------------------------------------------------------------
// T3-02: huella del ancla y posiciones válidas (RF3-02, RF3-03, RF3-10, RF3-13, DF3-06)
// ---------------------------------------------------------------------------

/** La vista útil: el adaptador ya descuenta el teclado del alto (como en la Fase 1). */
export type Entorno = { viewport: Rect; safeArea: Insets };

/** Hacia dónde se abre el abanico (RF3-15). */
export type Direccion = "arriba" | "abajo";

/** Un tramo de alturas válidas, en px de pantalla (y del centro del ancla; desde ≤ hasta). */
export type Intervalo = { desde: number; hasta: number };

/** Paso del muestreo de alturas, en px (design.md §4.3). */
const PASO_MUESTREO = 2;

function bordes(entorno: Entorno) {
  const { viewport: v, safeArea: s } = entorno;
  return { arriba: v.y + s.top, abajo: v.y + v.height - s.bottom, izquierda: v.x + s.left, derecha: v.x + v.width - s.right };
}

/** x del centro del ancla en un costado (como computeAnchorPosition de la Fase 1). */
export function xDelLado(lado: Lado, entorno: Entorno, params: Params): number {
  const b = bordes(entorno);
  const d = params.MARGEN_LATERAL + params.D_ACTIVO / 2;
  return lado === "right" ? b.derecha - d : b.izquierda + d;
}

/** y del centro del ancla para una altura (fracción del alto útil, como ANCLA_ALTURA), sin límites. */
export function yDeAltura(altura: number, entorno: Entorno): number {
  const b = bordes(entorno);
  return b.abajo - altura * (b.abajo - b.arriba);
}

/** La altura (fracción) que corresponde a una y de pantalla. */
export function alturaDeY(y: number, entorno: Entorno): number {
  const b = bordes(entorno);
  return (b.abajo - y) / (b.abajo - b.arriba);
}

/** Lo que ocupa el abanico más grande por encima (o por debajo) del ancla, más la banda. */
function alcance(params: Params) {
  const radio = radioAdaptativo(params.MAX_OPCIONES, params);
  const mitadOpcion = (params.D_OPCION * params.ESCALA_PRESEL) / 2;
  return { radio, mitadOpcion, total: radio + mitadOpcion + params.BANDA_MARGEN + params.BANDA_ALTO };
}

/**
 * Rango de alturas (y del centro) en el que el abanico cabe (HM-01): hacia arriba, del techo al
 * piso de la Fase 1; hacia abajo, lo mismo pero en espejo. null si no cabe en ninguna altura.
 */
export function rangoAlturas(entorno: Entorno, params: Params, direccion: Direccion): Intervalo | null {
  const b = bordes(entorno);
  const piso = b.abajo - params.MARGEN_INFERIOR - params.D_ACTIVO / 2;
  const techoAncla = b.arriba + params.D_ACTIVO / 2;
  const { total } = alcance(params);
  const r = direccion === "arriba" ? { desde: b.arriba + total, hasta: piso } : { desde: techoAncla, hasta: b.abajo - params.MARGEN_INFERIOR - total };
  return r.desde <= r.hasta ? r : null;
}

/**
 * Huella (DF3-06): los rectángulos que el ancla puede ocupar en esa posición: el ancla activa,
 * el abanico más grande (MAX_OPCIONES, opciones escaladas), la banda y la zona de avisos
 * encima de la banda. El ancho de la banda y los avisos depende del texto: se estima en
 * 2 × radio, centrado donde va la banda (posicionBanda).
 */
export function huellaAncla(punto: Point, lado: Lado, params: Params, direccion: Direccion = "arriba"): Rect[] {
  const { radio, mitadOpcion } = alcance(params);
  const hacia = lado === "right" ? -1 : 1; // el abanico se abre hacia el centro de la pantalla
  const signo = direccion === "arriba" ? -1 : 1;
  const mitadAncla = params.D_ACTIVO / 2;

  const ancla: Rect = { x: punto.x - mitadAncla, y: punto.y - mitadAncla, width: params.D_ACTIVO, height: params.D_ACTIVO };

  // Opciones entre 90° (sobre el ancla) y 180° (al costado): la caja va del ancla hacia el centro.
  const xLejos = punto.x + hacia * (radio + mitadOpcion);
  const xCerca = punto.x - hacia * mitadOpcion;
  const yLejos = punto.y + signo * (radio + mitadOpcion);
  const yCerca = punto.y - signo * mitadOpcion;
  const abanico: Rect = caja(xLejos, yLejos, xCerca, yCerca);

  // Banda y avisos: a partir del borde del abanico, hacia afuera.
  const xBanda = punto.x + (hacia * radio) / 2;
  const anchoBanda = 2 * radio;
  const yBandaCerca = yLejos + signo * params.BANDA_MARGEN;
  const yBandaLejos = yBandaCerca + signo * params.BANDA_ALTO;
  const banda = caja(xBanda - anchoBanda / 2, yBandaCerca, xBanda + anchoBanda / 2, yBandaLejos);
  const yAvisoCerca = yBandaLejos + signo * params.BANDA_MARGEN;
  const avisos = caja(xBanda - anchoBanda / 2, yAvisoCerca, xBanda + anchoBanda / 2, yAvisoCerca + signo * ALTO_AVISO);

  return [ancla, abanico, banda, avisos];
}

/** Alto de la zona de avisos (el aviso de deshacer o de bloqueo), en px. */
const ALTO_AVISO = 44;

function caja(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function seTocan(a: Rect, b: Rect, margen: number): boolean {
  return a.x < b.x + b.width + margen && b.x - margen < a.x + a.width && a.y < b.y + b.height + margen && b.y - margen < a.y + a.height;
}

/** ¿La huella en esa posición deja libres las zonas (más MARGEN_ZONA)? */
export function colocacionLibre(punto: Point, lado: Lado, zonas: Zona[], params: Params, direccion: Direccion = "arriba"): boolean {
  const huella = huellaAncla(punto, lado, params, direccion);
  return zonas.every((z) => huella.every((r) => !seTocan(r, z.rect, params.MARGEN_ZONA)));
}

/**
 * Posiciones válidas (RF3-02, RF3-03): por costado, los tramos de alturas (y del centro) donde
 * la huella no toca ninguna zona respetada. Con `soloObligatorias`, las preferidas se ignoran
 * (RF3-13). Se calcula en reposo, no por cuadro (RNF3-01).
 */
export function posicionesValidas(
  entorno: Entorno,
  zonas: Zona[],
  params: Params,
  opciones: { soloObligatorias?: boolean; direccion?: Direccion } = {},
): Record<Lado, Intervalo[]> {
  const direccion = opciones.direccion ?? "arriba";
  const respetadas = opciones.soloObligatorias ? zonas.filter((z) => z.prioridad === "obligatoria") : zonas;
  const rango = rangoAlturas(entorno, params, direccion);
  const resultado: Record<Lado, Intervalo[]> = { right: [], left: [] };
  if (!rango) return resultado;
  for (const lado of ["right", "left"] as const) {
    const x = xDelLado(lado, entorno, params);
    let abierto: Intervalo | null = null;
    const muestras: number[] = [];
    for (let y = rango.desde; y < rango.hasta; y += PASO_MUESTREO) muestras.push(y);
    muestras.push(rango.hasta);
    for (const y of muestras) {
      if (colocacionLibre({ x, y }, lado, respetadas, params, direccion)) {
        if (abierto) abierto.hasta = y;
        else abierto = { desde: y, hasta: y };
      } else if (abierto) {
        resultado[lado].push(abierto);
        abierto = null;
      }
    }
    if (abierto) resultado[lado].push(abierto);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// T3-03: imán y resolver la colocación (RF3-03, RF3-05, RF3-12, RF3-13, RF3-15)
// ---------------------------------------------------------------------------

/** La y más cercana a `y` dentro de los tramos (null si no hay tramos). */
function masCercana(y: number, tramos: Intervalo[]): number | null {
  let mejor: number | null = null;
  for (const t of tramos) {
    const c = Math.min(t.hasta, Math.max(t.desde, y));
    if (mejor === null || Math.abs(c - y) < Math.abs(mejor - y)) mejor = c;
  }
  return mejor;
}

/**
 * Imán al soltar en modo edición (RF3-03, DF3-02, DF3-03): el costado más cercano al punto y,
 * en ese costado, la altura válida más cercana. Si ese costado no tiene ninguna, el otro.
 * Cambiar de costado cambia la mano (H13). null si no hay ninguna posición válida.
 */
export function imanColocacion(punto: Point, entorno: Entorno, validas: Record<Lado, Intervalo[]>): Colocacion | null {
  const b = bordes(entorno);
  const cerca: Lado = punto.x < (b.izquierda + b.derecha) / 2 ? "left" : "right";
  for (const lado of [cerca, cerca === "right" ? "left" : "right"] as const) {
    const y = masCercana(punto.y, validas[lado]);
    if (y !== null) return { lado, altura: alturaDeY(y, entorno) };
  }
  return null;
}

/** Resultado de resolver dónde va el ancla ahora. */
export type ColocacionResuelta = {
  punto: Point;
  lado: Lado;
  abreHacia: Direccion;
  /** La guardada no se pudo usar tal cual: se usa otra altura (la guardada no se borra, RF3-12). */
  ajustada: boolean;
  /** null; "preferidas" = tapa alguna zona preferida; "sin_lugar" = no hay posición válida (RF3-13). */
  conflicto: null | "preferidas" | "sin_lugar";
};

/**
 * Dónde va el ancla ahora, a partir de la colocación guardada (design.md §4.4):
 * 1–2) la guardada, o la altura válida más cercana del mismo costado, respetando todas las zonas;
 * 3) lo mismo respetando solo las obligatorias (conflicto "preferidas");
 * 4) si el abanico no cabe hacia arriba en ninguna altura, hacia abajo (RF3-15; "bajar el ancla"
 *    ya está en 1–3: el techo del rango es la altura más alta en la que cabe hacia arriba);
 * 5) si no cabe en ninguna dirección: la dirección con más espacio (conflicto "sin_lugar").
 * Nunca cambia de costado: eso lo decide la persona (H13).
 */
export function resolverColocacion(guardada: Colocacion, entorno: Entorno, zonas: Zona[], params: Params): ColocacionResuelta {
  const x = xDelLado(guardada.lado, entorno, params);
  const deseada = yDeAltura(guardada.altura, entorno);
  for (const abreHacia of ["arriba", "abajo"] as const) {
    for (const soloObligatorias of [false, true]) {
      const tramos = posicionesValidas(entorno, zonas, params, { soloObligatorias, direccion: abreHacia })[guardada.lado];
      const y = masCercana(deseada, tramos);
      if (y === null) continue;
      return {
        punto: { x, y },
        lado: guardada.lado,
        abreHacia,
        ajustada: Math.abs(y - deseada) > 0.5,
        conflicto: soloObligatorias ? "preferidas" : null,
      };
    }
  }
  // 5) Sin lugar: el ancla dentro de la pantalla, y el abanico hacia donde haya más espacio.
  const b = bordes(entorno);
  const minimo = b.arriba + params.D_ACTIVO / 2;
  const maximo = b.abajo - params.MARGEN_INFERIOR - params.D_ACTIVO / 2;
  const y = Math.min(maximo, Math.max(minimo, deseada));
  return {
    punto: { x, y },
    lado: guardada.lado,
    abreHacia: y - b.arriba >= b.abajo - y ? "arriba" : "abajo",
    ajustada: Math.abs(y - deseada) > 0.5,
    conflicto: "sin_lugar",
  };
}
