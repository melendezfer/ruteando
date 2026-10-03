"use client";

import {
  colocacionPara,
  DEFAULT_PARAMS,
  pantallaDeCapa,
  prefsDesdeMano,
  validateScreen,
  type AnchorPrefs,
  type AnchorScreen,
  type Apuntado,
  type CapaAncla,
  type Params,
  type PrefsAncla,
} from "@boton-ancla/core";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Ancla } from "./components/Ancla";
import { useCapas, type CapaReact, type ControlCapas } from "./dom/capas";
import { useOrientacion } from "./dom/entorno";
import { useZonas, type FuenteZona, type RegistroZonas } from "./dom/zonas";
import type { AnchorProviderProps, OpcionesApuntarLista, ReactAnchorIcon } from "./types";

// Proveedor del botón-ancla (spec §7). Guarda la pantalla actual y dibuja el
// ancla en un portal sobre document.body, fuera del contenido de la app
// (así los eventos no llegan, por ejemplo, al mapa).

type Registro = {
  /** Pantalla más reciente (se actualiza en cada render: los onSelect siempre al día). */
  pantallaRef: RefObject<AnchorScreen | null>;
  /** Qué llamada a useAnchorScreen registró la pantalla actual (solo ella la puede quitar). */
  duenoRef: RefObject<symbol | null>;
  /** Publica una copia para dibujar cuando cambia algo visible (id, etiquetas, deshabilitadas). */
  publicar: (pantalla: AnchorScreen | null) => void;
};

const ContextoRegistro = createContext<Registro | null>(null);
const ContextoCapas = createContext<ControlCapas | null>(null);
const ContextoZonas = createContext<RegistroZonas | null>(null);
/** Fase 3 (DF3-01): entrar al modo edición desde un botón de la app. */
type Mover = { mover: () => void; editando: boolean };
const ContextoMover = createContext<Mover | null>(null);

/**
 * Contenido principal que desplaza el ancla: un elemento o la ventana (vertical, HM-09), o
 * un mapa (libre en todas las direcciones, HM-11).
 */
export type ObjetivoDesplazar = HTMLElement | "ventana" | ObjetivoLibre;
/** HM-11: mueve la vista `dx`, `dy` px hacia donde apunta el pulgar. `false` = llegó al borde. */
export type ObjetivoLibre = {
  tipo: "libre";
  mover: (dx: number, dy: number) => boolean | void;
  /** RF-21 (HM-12a): apuntar y elegir, si la app lo ofrece. */
  apuntar: () => OpcionesApuntar | undefined;
};

/** RF-21: un objetivo que se puede apuntar, en coordenadas de pantalla. */
export type ObjetivoApuntable = { id: string; x: number; y: number; label: string; icon?: ReactAnchorIcon };

/** RF-21 (HM-12a): lo que la app ofrece para apuntar y elegir en su mapa. */
export type OpcionesApuntar = {
  /** Los objetivos visibles, en pantalla (se piden cuadro a cuadro mientras se usa el joystick). */
  objetivos: () => ObjetivoApuntable[];
  /** Soltar frenado sobre un objetivo o un grupo: abre su capa (HM-08). */
  elegir: (apuntado: Apuntado) => void;
  /** Zoom automático sobre un grupo (nivel 3): acercar `factor` veces alrededor de `centro`. */
  acercar: (factor: number, centro: { x: number; y: number }) => void;
  /** Dónde está la mira. Por defecto, el centro de la parte visible. */
  mira?: () => { x: number; y: number };
  /** Texto de un grupo junto a la mira. Por defecto "N lugares". */
  etiquetaGrupo?: (n: number) => string;
};

export function esLibre(o: ObjetivoDesplazar | null): o is ObjetivoLibre {
  return typeof o === "object" && o !== null && "tipo" in o && o.tipo === "libre";
}
type RegistroDesplazar = {
  objetivo: RefObject<ObjetivoDesplazar | null>;
  /** HM-12b: lo que ofrece para apuntar la lista principal (useAnchorScroll). */
  apuntarPrincipal: RefObject<OpcionesApuntarLista | null>;
  /** Avisa que se registró o quitó un objetivo (para recalcular si hay algo desplazable). */
  avisar: () => void;
};
const ContextoDesplazar = createContext<RegistroDesplazar | null>(null);

/** Espacio que ocupa el ancla desde el borde de su lado (HM-07). */
export type ReservaAncla = { lado: "right" | "left"; ancho: number };
const ContextoReserva = createContext<ReservaAncla | null>(null);

export function AnchorProvider({
  prefs,
  placement,
  onPlacementChange,
  theme,
  icons,
  onEvent,
  params: parciales,
  desplazar = false,
  desplazarLibre = false,
  apuntar = false,
  guiaDesplazar = "ancla",
  children,
}: AnchorProviderProps) {
  const pantallaRef = useRef<AnchorScreen | null>(null);
  const duenoRef = useRef<symbol | null>(null);
  // Copia para DIBUJAR. Para EJECUTAR se usa pantallaRef (siempre la más reciente).
  const [pantalla, publicar] = useState<AnchorScreen | null>(null);
  const [montado, setMontado] = useState(false);

  // Los parámetros se comparan por valor: un objeto nuevo en cada render no los cambia.
  const clave = JSON.stringify(parciales ?? {});
  const params: Params = useMemo(() => Object.freeze({ ...DEFAULT_PARAMS, ...(JSON.parse(clave) as Partial<Params>) }), [clave]);

  const onEventRef = useRef(onEvent);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
  });

  // El portal necesita document: solo después de montar en el navegador.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- esperar al navegador para usar document.body
    setMontado(true);
  }, []);

  const registro = useMemo<Registro>(() => ({ pantallaRef, duenoRef, publicar }), []);
  const capas = useCapas(onEventRef);
  const objetivoDesplazar = useRef<ObjetivoDesplazar | null>(null);
  const [versionObjetivo, setVersionObjetivo] = useState(0);
  const apuntarPrincipal = useRef<OpcionesApuntarLista | null>(null);
  const registroDesplazar = useMemo<RegistroDesplazar>(
    () => ({ objetivo: objetivoDesplazar, apuntarPrincipal, avisar: () => setVersionObjetivo((v) => v + 1) }),
    [],
  );
  // Fase 3 (RF3-06): la colocación por orientación. Sin `placement`, la guarda el propio ancla,
  // partiendo de `prefs.hand` (si la app cambia la mano, se vuelve a partir de ella).
  const orientacion = useOrientacion();
  const [interna, setInterna] = useState<{ hand: AnchorPrefs["hand"]; prefs: PrefsAncla | null }>({ hand: prefs.hand, prefs: null });
  if (interna.hand !== prefs.hand) setInterna({ hand: prefs.hand, prefs: null });
  const colocacion = placement ?? interna.prefs ?? prefsDesdeMano(prefs.hand, params);
  const onPlacementRef = useRef(onPlacementChange);
  useLayoutEffect(() => {
    onPlacementRef.current = onPlacementChange;
  });
  const cambiarColocacion = useCallback(
    (nueva: PrefsAncla) => {
      if (!placement) setInterna((i) => ({ ...i, prefs: nueva }));
      onPlacementRef.current?.(nueva);
    },
    [placement],
  );
  const ladoActual = colocacionPara(colocacion, orientacion, params).lado;
  const zonas = useZonas();
  // Fase 3 (DF3-01): el ancla registra cómo entrar al modo edición; la app lo llama con useAnchorMove.
  const entrarAEditar = useRef<() => void>(() => {});
  const [editando, setEditando] = useState(false);
  const mover = useMemo<Mover>(() => ({ mover: () => entrarAEditar.current(), editando }), [editando]);
  const reserva = useMemo<ReservaAncla>(
    () => ({ lado: ladoActual, ancho: params.MARGEN_LATERAL + params.D_ACTIVO }),
    [ladoActual, params.MARGEN_LATERAL, params.D_ACTIVO],
  );

  return (
    <ContextoRegistro.Provider value={registro}>
      <ContextoReserva.Provider value={reserva}>
      <ContextoDesplazar.Provider value={registroDesplazar}>
      <ContextoCapas.Provider value={capas}>
      <ContextoZonas.Provider value={zonas}>
      <ContextoMover.Provider value={mover}>
        {children}
        {montado &&
          createPortal(
            <Ancla
              pantalla={pantalla}
              pantallaRef={pantallaRef}
              colocacion={colocacion}
              orientacion={orientacion}
              cambiarColocacion={cambiarColocacion}
              zonas={zonas}
              entrarAEditar={entrarAEditar}
              alEditando={setEditando}
              theme={theme}
              icons={icons}
              params={params}
              onEventRef={onEventRef}
              capas={capas}
              desplazar={desplazar}
              desplazarLibre={desplazarLibre}
              apuntar={apuntar}
              guiaDesplazar={guiaDesplazar}
              objetivoDesplazar={objetivoDesplazar}
              apuntarPrincipal={apuntarPrincipal}
              versionObjetivo={versionObjetivo}
            />,
            document.body,
          )}
      </ContextoMover.Provider>
      </ContextoZonas.Provider>
      </ContextoCapas.Provider>
      </ContextoDesplazar.Provider>
      </ContextoReserva.Provider>
    </ContextoRegistro.Provider>
  );
}

/**
 * HM-09: registra el contenido principal que desplaza el ancla (el perfil, una lista, un
 * documento). "ventana" = la página entera. Sin registro no hay modo desplazamiento: así
 * el mapa, que no se registra, sigue igual (HU-13). Mientras una capa esté abierta, se
 * desplaza la capa (su `scrollRef`), no esto.
 */
export function useAnchorScroll(objetivo: RefObject<HTMLElement | null> | "ventana", apuntar?: OpcionesApuntarLista): void {
  const registro = useContext(ContextoDesplazar);
  if (!registro) throw new Error("useAnchorScroll debe usarse dentro de <AnchorProvider>.");
  const { objetivo: ref, apuntarPrincipal, avisar } = registro;
  // HM-12b: las funciones cambian en cada render; el ancla usa siempre las últimas.
  const apuntarRef = useRef(apuntar);
  useLayoutEffect(() => {
    apuntarRef.current = apuntar;
  });
  const conApuntar = Boolean(apuntar);
  useLayoutEffect(() => {
    const el = objetivo === "ventana" ? "ventana" : objetivo.current;
    if (!el) return;
    ref.current = el;
    const opciones: OpcionesApuntarLista | null = conApuntar
      ? { elementos: () => apuntarRef.current?.elementos() ?? [], elegir: (id) => apuntarRef.current?.elegir(id) }
      : null;
    apuntarPrincipal.current = opciones;
    avisar();
    return () => {
      if (ref.current === el) {
        ref.current = null;
        if (apuntarPrincipal.current === opciones) apuntarPrincipal.current = null;
        avisar();
      }
    };
  }, [objetivo, ref, apuntarPrincipal, avisar, conApuntar]);
}

/**
 * HM-11 (experimental): registra un mapa como contenido principal. Con `apuntar` (RF-21,
 * HM-12a) y la prop `apuntar` del proveedor, la mira elige pines y grupos al soltar frenado. Con `desplazarLibre`, el
 * joystick del ancla lo mueve en todas las direcciones: `mover(dx, dy)` debe correr la vista
 * esos px hacia donde apunta el pulgar (dx > 0 = ver lo que está a la derecha) y devolver
 * `false` si ya estaba en el borde. Con una capa abierta encima, manda la capa.
 */
export function useAnchorPan(mover: (dx: number, dy: number) => boolean | void, apuntar?: OpcionesApuntar): void {
  const registro = useContext(ContextoDesplazar);
  if (!registro) throw new Error("useAnchorPan debe usarse dentro de <AnchorProvider>.");
  const { objetivo: ref, avisar } = registro;
  const moverRef = useRef(mover);
  const apuntarRef = useRef(apuntar);
  useLayoutEffect(() => {
    moverRef.current = mover;
    apuntarRef.current = apuntar;
  });
  useLayoutEffect(() => {
    const libre: ObjetivoLibre = { tipo: "libre", mover: (dx, dy) => moverRef.current(dx, dy), apuntar: () => apuntarRef.current };
    ref.current = libre;
    avisar();
    return () => {
      if (ref.current === libre) {
        ref.current = null;
        avisar();
      }
    };
  }, [ref, avisar]);
}

/**
 * Fase 3 (RF3-10…RF3-13): declara una zona que el ancla, su abanico, la banda y los avisos no
 * deben tapar: un elemento fijo en pantalla (por referencia; se sigue su tamaño) o un
 * rectángulo en coordenadas de la vista. "obligatoria" nunca se tapa (por ejemplo, el crédito
 * del mapa); "preferida" (por defecto) solo si no hay otro lugar.
 */
export function useAnchorReservedArea(objetivo: FuenteZona, opciones: { prioridad?: "obligatoria" | "preferida" } = {}): void {
  const zonas = useContext(ContextoZonas);
  if (!zonas) throw new Error("useAnchorReservedArea debe usarse dentro de <AnchorProvider>.");
  const { registrar, quitar } = zonas;
  const prioridad = opciones.prioridad ?? "preferida";
  // Una referencia se compara por identidad; un rectángulo, por valor (un objeto nuevo en cada
  // render no lo cambia). Se registra la fuente más reciente.
  const referencia = "current" in objetivo ? objetivo : null;
  const claveRect = referencia ? null : JSON.stringify(objetivo);
  const fuente = useRef(objetivo);
  useLayoutEffect(() => {
    fuente.current = objetivo;
  });
  useLayoutEffect(() => {
    const clave = Symbol("zona");
    registrar(clave, fuente.current, prioridad);
    return () => quitar(clave);
  }, [registrar, quitar, prioridad, claveRect, referencia]);
}

/**
 * Fase 3 (DF3-01): para un botón "Mover el ancla" de la app (por ejemplo en Ajustes). `mover()`
 * entra al modo edición; el siguiente toque sobre el ancla la engancha al dedo. Solo deslizando
 * se entra con una opción `moveAnchor` del abanico (quedándose quieto sobre ella).
 */
export function useAnchorMove(): Mover {
  const m = useContext(ContextoMover);
  if (!m) throw new Error("useAnchorMove debe usarse dentro de <AnchorProvider>.");
  return m;
}

/**
 * HM-07: lado del ancla y ancho que ocupa desde ese borde (MARGEN_LATERAL + D_ACTIVO).
 * Las hojas y barras de la app reservan ese espacio para que sus controles (p. ej. la X)
 * no queden debajo del ancla.
 */
export function useAnchorReserva(): ReservaAncla {
  const reserva = useContext(ContextoReserva);
  if (!reserva) throw new Error("useAnchorReserva debe usarse dentro de <AnchorProvider>.");
  return reserva;
}

/**
 * Declara una capa abierta encima del contenido (HM-03, HM-08, RF-15): una hoja, una
 * lista, la búsqueda. Mientras `abierta` sea true, el abanico muestra "Cerrar" a 90° y
 * las acciones de la capa (las de la pantalla de fondo se ocultan); el centro muestra su
 * ícono y nombre. El botón atrás del sistema y Escape llaman `onClose` en vez de navegar.
 *
 * Devuelve `cerrar`: úsala en el botón de cerrar propio de la capa (su X). Cierra por el
 * historial, así el "atrás" siguiente navega normal. Si la capa se cierra porque se
 * navega (un enlace dentro de ella), basta con cerrar el estado como siempre.
 */
export function useAnchorLayer(abierta: boolean, onClose: () => void, capa: CapaReact = {}): () => void {
  const capas = useContext(ContextoCapas);
  if (!capas) throw new Error("useAnchorLayer debe usarse dentro de <AnchorProvider>.");
  const { agregar, quitar, cerrar, actualizar } = capas;
  const onCloseRef = useRef(onClose);
  const datosRef = useRef<CapaReact>(capa);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    datosRef.current = capa;
  });

  // Se vuelve a dibujar solo si cambia algo visible de la capa (como la firma de useAnchorScreen).
  const firma = [
    capa.label ?? "",
    ...(capa.actions ?? []).map((a) => `${a.id}:${a.label}:${a.kind ?? "normal"}:${a.disabled ? 1 : 0}:${a.priority ?? ""}`),
  ].join("|");
  const icono = capa.icon;
  const conDesplazar = Boolean(capa.scrollRef);
  const conApuntar = Boolean(capa.apuntar);
  useLayoutEffect(() => {
    if (!abierta) return;
    if (process.env.NODE_ENV !== "production") {
      const errores = validateScreen(pantallaDeCapa({ id: "capa", sectionIcon: null, sectionLabel: "capa", actions: [] }, datosRef.current), {
        ...DEFAULT_PARAMS,
      });
      if (errores.length > 0) throw new Error(`Capa del ancla inválida:\n- ${errores.join("\n- ")}`);
    }
    actualizar();
  }, [abierta, firma, icono, conDesplazar, conApuntar, actualizar]);
  const claveRef = useRef<symbol | null>(null);
  useLayoutEffect(() => {
    if (!abierta) return;
    const clave = Symbol("capa");
    claveRef.current = clave;
    agregar({ clave, onClose: onCloseRef, datos: datosRef });
    return () => {
      quitar(clave);
      if (claveRef.current === clave) claveRef.current = null;
    };
  }, [abierta, agregar, quitar]);
  return useCallback(() => {
    if (claveRef.current) cerrar(claveRef.current);
    else onCloseRef.current();
  }, [cerrar]);
}

/**
 * Registra la pantalla actual del ancla (spec §7). Llamarlo en cada sección.
 * El cambio de sección se detecta por screen.id (RF-10), no por identidad del objeto.
 */
export function useAnchorScreen(screen: AnchorScreen): void {
  const registro = useContext(ContextoRegistro);
  if (!registro) throw new Error("useAnchorScreen debe usarse dentro de <AnchorProvider>.");
  const { pantallaRef, duenoRef, publicar } = registro;
  const [yo] = useState(() => Symbol("useAnchorScreen"));

  const firma = [
    screen.id,
    screen.sectionLabel,
    screen.back ? "atras" : "",
    ...screen.actions.map((a) => `${a.id}:${a.label}:${a.kind ?? "normal"}:${a.disabled ? 1 : 0}:${a.priority ?? ""}`),
  ].join("|");

  // Siempre la versión más reciente, para que los onSelect no queden viejos.
  useLayoutEffect(() => {
    pantallaRef.current = screen;
    duenoRef.current = yo;
  });

  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const errores = validateScreen(screen, { ...DEFAULT_PARAMS });
      if (errores.length > 0) throw new Error(`Pantalla del ancla inválida:\n- ${errores.join("\n- ")}`);
    }
    publicar(screen);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia lo visible (firma)
  }, [firma, publicar]);

  // Al salir de la sección. Es de layout (no useEffect) para correr ANTES de que la
  // pantalla nueva se registre; y solo limpia si el registro sigue siendo suyo.
  useLayoutEffect(
    () => () => {
      if (duenoRef.current !== yo) return;
      pantallaRef.current = null;
      duenoRef.current = null;
      publicar(null);
    },
    [pantallaRef, duenoRef, publicar, yo],
  );
}
