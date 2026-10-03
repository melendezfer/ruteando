import { type Apuntado,
  derivarMetricas,
  distancia,
  ID_ATRAS,
  ID_CERRAR,
  ID_DESHACER,
  ID_OCULTAR_TECLADO,
  type AnchorEvent,
  type AnchorScreen,
  type AnchorState,
  type Geometry,
  type Machine,
  type MetricEvent,
  type Point,
  type Tecla,
} from "@boton-ancla/core";

// Puente entre el navegador y la máquina pura (design.md §3.1 y §6).
// - Lee el tiempo con performance.now() (no event.timeStamp: L-07).
// - Escucha los punteros en window mientras el menú no está en reposo, así
//   ve también un segundo dedo en cualquier parte de la pantalla (RF-09).
// - Ejecuta los efectos: onSelect SÍNCRONO dentro del pointerup (L-04),
//   vibración, métricas y COMPLETADO para volver a reposo.

export type EfectosAncla = {
  /**
   * Una acción se ejecutó. `id` es el de la opción (incluye "atras" y "deshacer").
   * `resultado` es lo que devolvió onSelect (puede ser una promesa, C-19).
   */
  alEjecutar?: (id: string, pantalla: AnchorScreen, resultado: unknown) => void;
  /** Se soltó sobre una irreversible sin cruzar el anillo (HU-08). */
  alBloquear?: (id: string) => void;
  /** Ejecuta "deshacer" (C-21): lo resuelve el adaptador, que conoce la acción original. */
  alDeshacer?: () => void;
  /** Ejecuta "cerrar" (HM-03): cierra la capa de arriba. */
  alCerrarCapa?: () => void;
  /** RF-21: soltó frenado sobre algo en la mira: abrir su capa. */
  alElegir?: (apuntado: Apuntado) => void;
  /** Fase 3 (RF3-03): soltó el ancla en modo edición: imán y guardar. */
  alSoltar?: (punto: Point) => void;
};

type Opciones = {
  machine: Machine;
  /** Geometría actual para empezar una interacción (null si no hay pantalla). */
  obtenerGeo: () => Geometry | null;
  /** Pantalla más reciente, para ejecutar su onSelect. */
  obtenerPantalla: () => AnchorScreen | null;
  onEvent: (m: MetricEvent) => void;
  efectos: EfectosAncla;
};

const ABIERTOS: readonly AnchorState["tipo"][] = [
  "abierto_gesto",
  "confirmacion_armada",
  "abierto_toque",
  "confirmacion_toque",
  "abierto_teclado",
];

export function menuAbierto(estado: AnchorState): boolean {
  return ABIERTOS.includes(estado.tipo);
}

export class Controlador {
  private readonly o: Opciones;
  private cola: AnchorEvent[] = [];
  private ocupado = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private escuchando = false;
  /** Último pointerdown/up en el ancla: sirve para distinguir un click de puntero de uno de lector de pantalla. */
  ultimoPunteroMs = -Infinity;

  constructor(opciones: Opciones) {
    this.o = opciones;
  }

  destruir() {
    clearTimeout(this.temporizador);
    this.dejarDeEscuchar();
  }

  /** Envía un evento. Los efectos pueden encolar otros (p. ej. COMPLETADO); se procesan en orden. */
  enviar(evento: AnchorEvent) {
    this.cola.push(evento);
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      while (this.cola.length > 0) {
        const e = this.cola.shift()!;
        const prev = this.o.machine.getState();
        const next = this.o.machine.send(e);
        if (next !== prev) this.efectos(prev, next, e);
      }
    } finally {
      this.ocupado = false;
    }
  }

  /** pointerdown sobre el botón del ancla (lo llama el componente React). */
  bajarEnAncla(e: PointerEvent, elemento: Element) {
    this.ultimoPunteroMs = performance.now();
    if (this.o.machine.getState().tipo !== "reposo") return; // con el menú abierto lo maneja window
    const geo = this.o.obtenerGeo();
    if (!geo) return;
    e.preventDefault(); // evita selección de texto y la lupa de iOS (RNF-02, L-05)
    try {
      elemento.setPointerCapture(e.pointerId); // RF-01
    } catch {
      // Eventos sintéticos (Playwright en WebKit): el gesto funciona igual.
    }
    this.enviar({ tipo: "POINTER_DOWN", pointerId: e.pointerId, punto: punto(e), t: performance.now(), sobre: "ancla", geo });
  }

  /** Tecla sobre el ancla en reposo (Enter, Espacio, ↑ abren con teclado: RNF-05). */
  teclaEnAncla(e: KeyboardEvent) {
    if (this.o.machine.getState().tipo !== "reposo") return;
    const tecla = teclaDe(e);
    const geo = this.o.obtenerGeo();
    if (!tecla || !geo || !["Enter", " ", "ArrowUp"].includes(tecla)) return;
    e.preventDefault(); // sin esto, Enter/Espacio también dispararían click
    this.enviar({ tipo: "TECLA", tecla, t: performance.now(), geo });
  }

  /**
   * Click en el ancla. Si no vino de un puntero (lector de pantalla, C-12), abre en modo
   * toque sin cierre por tiempo. Si vino de un toque, ya lo manejaron los eventos de puntero.
   */
  clicEnAncla() {
    const ahora = performance.now();
    if (ahora - this.ultimoPunteroMs < 700) return;
    const geo = this.o.obtenerGeo();
    if (this.o.machine.getState().tipo !== "reposo" || !geo) return;
    this.enviar({ tipo: "ACTIVAR", t: ahora, geo });
  }

  private readonly alTeclado = (e: KeyboardEvent) => {
    const tecla = teclaDe(e);
    if (!tecla) return;
    const antes = this.o.machine.getState();
    this.enviar({ tipo: "TECLA", tecla, t: performance.now() });
    // Se consume la tecla si la usó el menú (o si navega con flechas, para que no desplace la página).
    // Enter en la confirmación no se consume: así activa el botón "Confirmar" que tiene el foco.
    if (this.o.machine.getState() !== antes || antes.tipo === "abierto_teclado") e.preventDefault();
  };

  // --- punteros en window mientras el menú está activo ---------------------------------

  private readonly alPuntero = (e: PointerEvent) => {
    const estado = this.o.machine.getState();
    if (estado.tipo === "reposo") return;
    // Controles propios fuera del abanico ("Confirmar", el aviso de deshacer): no son "tocar fuera".
    if (e.type === "pointerdown" && e.target instanceof Element && e.target.closest("[data-ba-control]")) return;
    const p = punto(e);
    const t = performance.now();
    switch (e.type) {
      case "pointerdown":
        this.ultimoPunteroMs = t;
        this.enviar({ tipo: "POINTER_DOWN", pointerId: e.pointerId, punto: p, t, sobre: this.sobre(p, estado) });
        break;
      case "pointermove":
        this.enviar({ tipo: "POINTER_MOVE", pointerId: e.pointerId, punto: p, t });
        break;
      case "pointerup":
        this.ultimoPunteroMs = t;
        this.enviar({ tipo: "POINTER_UP", pointerId: e.pointerId, punto: p, t, sobre: this.sobre(p, estado) });
        break;
      case "pointercancel":
        this.enviar({ tipo: "POINTER_CANCEL", pointerId: e.pointerId });
        break;
    }
  };

  private escuchar() {
    if (this.escuchando) return;
    this.escuchando = true;
    for (const tipo of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
      window.addEventListener(tipo, this.alPuntero, { capture: true });
    }
    window.addEventListener("keydown", this.alTeclado, { capture: true });
  }

  private dejarDeEscuchar() {
    if (!this.escuchando) return;
    this.escuchando = false;
    for (const tipo of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
      window.removeEventListener(tipo, this.alPuntero, { capture: true });
    }
    window.removeEventListener("keydown", this.alTeclado, { capture: true });
  }

  /** ¿El punto cae sobre el ancla, sobre una opción o fuera? Por geometría, no por DOM. */
  private sobre(p: Point, estado: AnchorState): "ancla" | { id: string } | "fuera" {
    const geo = "geo" in estado ? estado.geo : this.o.obtenerGeo();
    if (!geo) return "fuera";
    const P = geo.params;
    if (distancia(geo.centro, p) <= P.D_ACTIVO / 2) return "ancla";
    const radioOpcion = (P.D_OPCION * P.ESCALA_PRESEL) / 2;
    const slot = geo.slots.find((s) => distancia(s.punto, p) <= radioOpcion);
    return slot ? { id: slot.id } : "fuera";
  }

  // --- efectos de cada transición -------------------------------------------------------

  private efectos(prev: AnchorState, next: AnchorState, evento: AnchorEvent) {
    for (const m of derivarMetricas(prev, next, evento)) this.o.onEvent(m);

    // Vibración al cambiar la preselección (RF-06, solo donde existe: D-02, L-01).
    const antes = preseleccion(prev);
    const ahora = preseleccion(next);
    if (ahora !== undefined && ahora !== antes) vibrar("geo" in next ? next.geo.params.VIB_MS : 10);

    switch (next.tipo) {
      case "ejecutando":
        this.ejecutar(next.id);
        this.enviar({ tipo: "COMPLETADO" });
        break;
      case "bloqueado_sensible":
        this.o.efectos.alBloquear?.(next.id);
        this.enviar({ tipo: "COMPLETADO" });
        break;
      case "cancelado":
        this.enviar({ tipo: "COMPLETADO" });
        break;
      case "soltado":
        this.o.efectos.alSoltar?.(next.punto);
        this.enviar({ tipo: "COMPLETADO" });
        break;
      case "elegido":
        // Síncrono, dentro del gesto (como ejecutar, L-04).
        try {
          this.o.efectos.alElegir?.(next.apuntado);
        } catch (error) {
          console.error("[boton-ancla] elegir falló:", error);
        }
        this.enviar({ tipo: "COMPLETADO" });
        break;
    }

    if (next.tipo === "reposo") this.dejarDeEscuchar();
    else this.escuchar();

    this.programarTick();
  }

  /** Llama la acción de forma SÍNCRONA (L-04): iOS solo abre el teclado dentro del gesto. */
  private ejecutar(id: string) {
    const pantalla = this.o.obtenerPantalla();
    if (!pantalla) return;
    try {
      let resultado: unknown;
      if (id === ID_ATRAS) pantalla.back?.onSelect();
      else if (id === ID_DESHACER) this.o.efectos.alDeshacer?.();
      else if (id === ID_CERRAR) this.o.efectos.alCerrarCapa?.();
      // RF-17: quitar el foco del campo baja el teclado virtual.
      else if (id === ID_OCULTAR_TECLADO) (document.activeElement as HTMLElement | null)?.blur?.();
      else {
        const accion = pantalla.actions.find((a) => a.id === id);
        if (!accion || accion.disabled) return;
        resultado = accion.onSelect();
      }
      this.o.efectos.alEjecutar?.(id, pantalla, resultado);
    } catch (error) {
      // Un error de la app no debe dejar el ancla trabada: se registra y se vuelve a reposo.
      console.error("[boton-ancla] la acción falló:", error);
    }
  }

  private programarTick() {
    clearTimeout(this.temporizador);
    const plazo = this.o.machine.nextDeadline();
    if (plazo === undefined) return;
    const espera = Math.max(0, plazo - performance.now());
    this.temporizador = setTimeout(() => this.enviar({ tipo: "TICK", t: performance.now() }), espera + 1);
  }
}

const TECLAS: readonly Tecla[] = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Enter", " ", "Escape"];

function teclaDe(e: KeyboardEvent): Tecla | undefined {
  if (e.altKey || e.ctrlKey || e.metaKey) return undefined;
  return TECLAS.includes(e.key as Tecla) ? (e.key as Tecla) : undefined;
}

function punto(e: PointerEvent): Point {
  return { x: e.clientX, y: e.clientY };
}

function preseleccion(estado: AnchorState): string | undefined {
  if (estado.tipo === "abierto_gesto" || estado.tipo === "confirmacion_armada") return estado.presel;
  return undefined;
}

function vibrar(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Algunos navegadores lo bloquean sin activación del usuario (L-01).
  }
}
