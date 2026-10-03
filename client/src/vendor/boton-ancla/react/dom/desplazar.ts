"use client";

import {
  indicadorDesplazamiento,
  indicadorJoystick,
  mismoApuntado,
  pasoCentrado,
  pasosApuntar,
  resolverApuntado,
  velocidadDesplazamiento,
  velocidadJoystick,
  zoomParaSeparar,
  type AnchorEvent,
  type AnchorState,
  type Apuntado,
  type Machine,
  type MetricEvent,
  type Params,
} from "@boton-ancla/core";
import { useEffect, useRef, type RefObject } from "react";
import { esLibre, type ObjetivoApuntable, type ObjetivoDesplazar, type ObjetivoLibre, type OpcionesApuntar } from "../AnchorProvider";
import type { OpcionesApuntarLista } from "../types";

// HM-09, RF-18: mientras la máquina está en "desplazando", desplaza el objetivo cuadro a
// cuadro con la velocidad del núcleo y mueve el punto de la guía. No usa estado de React
// (sería redibujar en cada cuadro: RNF-03); escribe directo en el DOM.
// HM-11: con un mapa, el joystick es libre. HM-12a: con apuntar, además mira, freno, imán
// y zoom automático (RF-21); y en "ajustando" mueve un deslizador como Zoom (RF-20).

/** Lo apuntado, con lo que hace falta para dibujarlo (RF-21). */
export type InfoApuntado = { apuntado: Apuntado; label: string; icon?: ObjetivoApuntable["icon"] };

type Opciones = {
  machine: Machine;
  estado: AnchorState;
  params: Params;
  /** Qué desplazar ahora (la capa de arriba o el contenido principal). */
  obtenerObjetivo: () => ObjetivoDesplazar | null;
  /** El punto de la cápsula que sigue al dedo (variante "arriba"). Su `data-escala` ajusta el recorrido si la cápsula se achicó. */
  puntoGuia: RefObject<HTMLElement | null>;
  /** La raíz del ancla (variante "ancla", HM-10): recibe `data-direccion` y `--ba-llenado`. */
  indicador: RefObject<HTMLElement | null>;
  /** RF-20: el `onSlide` de una opción deslizador. */
  obtenerDeslizador: (id: string) => ((paso: number) => void) | undefined;
  /** RF-21: ¿apuntar y elegir está activado? */
  apuntar: boolean;
  /** La mira (se ubica y se marca desde aquí, sin redibujar React). */
  mira: RefObject<HTMLElement | null>;
  /** Envía un evento a la máquina (APUNTAR) por el controlador, para que salgan las métricas. */
  enviar: (evento: AnchorEvent) => void;
  /** Registra una métrica que no sale de la máquina (auto_zoom). */
  emitir: (metrica: MetricEvent) => void;
  /** Avisa a React que cambió lo apuntado (solo cuando cambia: para el ícono y el nombre). */
  alApuntar: (info: InfoApuntado | null) => void;
  /** HM-12b (RF-23): la lista que se puede apuntar ahora, si hay. */
  obtenerApuntarLista: () => OpcionesApuntarLista | null;
  /** La franja de foco (se ubica desde aquí). */
  franja: RefObject<HTMLElement | null>;
};

/** RF-23: centro vertical de la parte visible de la lista (donde va la franja de foco). */
function centroVisible(o: ObjetivoVertical): number {
  const vv = window.visualViewport;
  const alto = vv ? vv.height : window.innerHeight;
  if (o === "ventana") return alto / 2;
  const r = o.getBoundingClientRect();
  const arriba = Math.max(r.top, 0);
  const abajo = Math.min(r.bottom, alto);
  return (arriba + abajo) / 2;
}

/** ¿La lista todavía puede desplazarse en el sentido de `delta` (positivo = hacia abajo)? */
function puedeDesplazar(o: ObjetivoVertical, delta: number): boolean {
  const pos = o === "ventana" ? window.scrollY : o.scrollTop;
  const max = o === "ventana" ? document.documentElement.scrollHeight - window.innerHeight : o.scrollHeight - o.clientHeight;
  return delta > 0 ? pos < max - 0.5 : pos > 0.5;
}

function centroY(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return r.top + r.height / 2;
}

type ObjetivoVertical = HTMLElement | "ventana";

function posicion(o: ObjetivoVertical): number {
  return o === "ventana" ? window.scrollY : o.scrollTop;
}

function desplazar(o: ObjetivoVertical, px: number) {
  if (o === "ventana") window.scrollBy(0, px);
  else o.scrollTop += px;
}

function vibrar(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Solo Android; sin activación del usuario algunos navegadores lo bloquean (L-01).
  }
}

/** Centro de la parte visible (la mira por defecto, RF-21). */
export function miraPorDefecto(): { x: number; y: number } {
  const vv = window.visualViewport;
  return vv ? { x: vv.offsetLeft + vv.width / 2, y: vv.offsetTop + vv.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** Opciones de apuntar del objetivo, si el mapa las ofrece y el interruptor está activado. */
export function opcionesApuntar(objetivo: ObjetivoDesplazar | null, activado: boolean): OpcionesApuntar | undefined {
  return activado && esLibre(objetivo) ? objetivo.apuntar() : undefined;
}

export function useBucleDesplazamiento(o: Opciones) {
  const { machine, estado, params } = o;
  const activo = estado.tipo === "desplazando" || estado.tipo === "ajustando";
  // Las funciones cambian en cada render; el bucle usa siempre la última.
  const ref = useRef(o);
  useEffect(() => {
    ref.current = o;
  });

  useEffect(() => {
    if (!activo) return;
    const inicial = machine.getState();
    const objetivo = inicial.tipo === "desplazando" ? ref.current.obtenerObjetivo() : null;
    if (inicial.tipo === "desplazando" && !objetivo) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let anterior = performance.now();
    let acumulado = 0; // fracciones de píxel: a velocidad baja, cada cuadro mueve menos de 1 px
    let acumuladoX = 0; // HM-11: en el joystick libre también en x
    let enBorde = 0; // -1 inicio, 1 final: para vibrar una sola vez al llegar
    let cuadro = 0;
    // RF-21, nivel 3: desde cuándo la mira está quieta sobre el mismo grupo.
    let grupoQuieto: { clave: string; desde: number; hecho: boolean } | null = null;
    let apuntadoAntes: Apuntado | null = null;
    // RF-23: estado del "apuntar" en listas (índice base al entrar, elemento en foco).
    let listaOrigen: unknown = null;
    let listaBase = 0;
    let listaIndice = -1;
    let listaFoco: HTMLElement | null = null;
    // HM-15: centrado por tiempo. Se guarda cuándo empezó y cuánto faltaba al empezar.
    let centradoLista: { desde: number; inicial: number } | null = null;
    let centradoMapa: { clave: string; desde: number; inicial: { x: number; y: number } } | null = null;
    const { puntoGuia, indicador, mira, franja } = ref.current;

    const soltarFoco = () => {
      if (listaFoco) delete listaFoco.dataset.baFoco;
      if (listaIndice !== -1) ref.current.alApuntar(null);
      listaFoco = null;
      listaIndice = -1;
      listaOrigen = null;
      centradoLista = null;
    };

    /** RF-23: apuntar en una lista. Pasos de uno en uno; la lista se desliza para centrar el foco en la franja. */
    const apuntarEnLista = (o: ObjetivoVertical, s: Extract<AnchorState, { tipo: "desplazando" }>, ahora: number) => {
      const opciones = ref.current.obtenerApuntarLista();
      const elementos = opciones?.elementos() ?? [];
      if (!s.origenApuntar || elementos.length === 0) return;
      const yFranja = centroVisible(o);
      if (listaOrigen !== s.origenApuntar) {
        // Al entrar: el elemento más cercano a la franja.
        listaOrigen = s.origenApuntar;
        let mejor = 0;
        elementos.forEach((e, i) => {
          if (Math.abs(centroY(e.el) - yFranja) < Math.abs(centroY(elementos[mejor]!.el) - yFranja)) mejor = i;
        });
        listaBase = mejor;
        listaIndice = -1;
      }
      const indice = Math.max(0, Math.min(elementos.length - 1, listaBase + pasosApuntar(s.ultimo.y - s.origenApuntar.y, params)));
      const e = elementos[indice]!;
      if (indice !== listaIndice) {
        centradoLista = null; // otro elemento: el centrado empieza de nuevo
        if (listaFoco) delete listaFoco.dataset.baFoco;
        e.el.dataset.baFoco = "";
        listaFoco = e.el;
        listaIndice = indice;
        vibrar(params.VIB_MS);
        const apuntado: Apuntado = { tipo: "uno", id: e.id };
        ref.current.enviar({ tipo: "APUNTAR", apuntado });
        ref.current.alApuntar({ apuntado, label: e.label, icon: e.icon });
      }
      // La lista se desliza hasta que el elemento en foco queda centrado en la franja (HM-15: por tiempo).
      const r = e.el.getBoundingClientRect();
      const delta = r.top + r.height / 2 - yFranja;
      let yDibujo = yFranja;
      if (Math.abs(delta) >= 0.5) {
        centradoLista ??= { desde: ahora, inicial: delta };
        const m = pasoCentrado({ restante: delta, inicial: centradoLista.inicial, transcurrido: ahora - centradoLista.desde, params, reducido });
        const antes = posicion(o);
        if (m !== 0) desplazar(o, m);
        // En un extremo de la lista ya no se puede desplazar: la franja va hasta el elemento.
        if (m !== 0 && Math.abs(posicion(o) - antes) < 0.25) yDibujo = r.top + r.height / 2;
        else if (m === 0 && !puedeDesplazar(o, delta)) yDibujo = r.top + r.height / 2;
      }
      const f = franja.current;
      if (f) {
        const alto = r.height + 8;
        f.style.top = `${yDibujo - alto / 2}px`;
        f.style.height = `${alto}px`;
        f.style.left = `${r.left - 4}px`;
        f.style.width = `${r.width + 8}px`;
      }
    };

    /** Flecha y anillo (HM-10) para un movimiento vertical: desplazar o ajustar. */
    const guiaVertical = (dy: number) => {
      const punto = puntoGuia.current;
      if (punto) {
        const escala = Number(punto.dataset.escala ?? 1);
        const limitado = Math.max(-params.R_MAX_DESPLAZAR, Math.min(params.R_MAX_DESPLAZAR, dy)) * escala;
        punto.style.transform = `translate(-50%, calc(-50% + ${limitado}px))`;
      }
      const ancla = indicador.current;
      if (ancla) {
        const { direccion, llenado } = indicadorDesplazamiento(dy, params);
        ancla.dataset.direccion = direccion > 0 ? "abajo" : direccion < 0 ? "arriba" : "quieto";
        ancla.style.setProperty("--ba-llenado", llenado.toFixed(3));
      }
    };

    /** RF-21: qué hay en la mira; freno, imán y zoom automático. Devuelve el factor de freno. */
    const apuntarEnMapa = (libre: ObjetivoLibre, s: Extract<AnchorState, { tipo: "desplazando" }>, quieto: boolean, ahora: number): number => {
      const opciones = opcionesApuntar(libre, ref.current.apuntar);
      if (!opciones) return 1;
      const puntoMira = opciones.mira?.() ?? miraPorDefecto();
      const objetivos = opciones.objetivos();
      const { apuntado, destino } = resolverApuntado(puntoMira, objetivos, params);

      const el = mira.current;
      if (el) {
        el.style.left = `${puntoMira.x}px`;
        el.style.top = `${puntoMira.y}px`;
        el.style.visibility = "visible";
        if (apuntado) el.dataset.apuntado = apuntado.tipo;
        else delete el.dataset.apuntado;
      }

      if (!mismoApuntado(apuntadoAntes, apuntado)) {
        apuntadoAntes = apuntado;
        if (!mismoApuntado(s.apuntado ?? null, apuntado)) ref.current.enviar({ tipo: "APUNTAR", apuntado });
        if (!apuntado) ref.current.alApuntar(null);
        else if (apuntado.tipo === "uno") {
          const o = objetivos.find((x) => x.id === apuntado.id);
          ref.current.alApuntar({ apuntado, label: o?.label ?? apuntado.id, icon: o?.icon });
        } else {
          const n = apuntado.ids.length;
          ref.current.alApuntar({ apuntado, label: opciones.etiquetaGrupo?.(n) ?? `${n} lugares` });
        }
        if (apuntado) vibrar(params.VIB_MS);
      }

      // Imán: con el pulgar quieto, lo apuntado se centra en la mira (HM-15: espera y duración por tiempo).
      if (apuntado && destino && quieto) {
        const clave = apuntado.tipo === "uno" ? apuntado.id : apuntado.ids.join("|");
        const falta = { x: destino.x - puntoMira.x, y: destino.y - puntoMira.y };
        if (centradoMapa?.clave !== clave) centradoMapa = { clave, desde: ahora, inicial: falta };
        const t = ahora - centradoMapa.desde;
        const mx = pasoCentrado({ restante: falta.x, inicial: centradoMapa.inicial.x, transcurrido: t, params, reducido });
        const my = pasoCentrado({ restante: falta.y, inicial: centradoMapa.inicial.y, transcurrido: t, params, reducido });
        if (Math.abs(mx) >= 0.01 || Math.abs(my) >= 0.01) libre.mover(mx, my);
      } else centradoMapa = null;

      // Nivel 3: zoom automático solo con la mira QUIETA sobre el mismo grupo T_ZOOM_GRUPO.
      if (apuntado?.tipo === "grupo" && quieto && destino) {
        const clave = apuntado.ids.join("|");
        if (grupoQuieto?.clave !== clave) grupoQuieto = { clave, desde: ahora, hecho: false };
        else if (!grupoQuieto.hecho && ahora - grupoQuieto.desde >= params.T_ZOOM_GRUPO) {
          grupoQuieto.hecho = true;
          const miembros = objetivos.filter((x) => apuntado.ids.includes(x.id));
          opciones.acercar(zoomParaSeparar(miembros, params), destino);
          ref.current.emitir({ type: "auto_zoom", n: apuntado.ids.length });
        }
      } else grupoQuieto = null;

      return apuntado ? params.FRENO_APUNTAR : 1;
    };

    const paso = (ahora: number) => {
      const s = machine.getState();
      const dt = Math.min(64, ahora - anterior); // si la pestaña se pausó, no dar un salto
      anterior = ahora;

      if (s.tipo === "ajustando") {
        // RF-20: pulgar arriba = más (acercar), abajo = menos; con la curva de RF-18.
        const dy = s.ultimo.y - s.origen.y;
        const v = velocidadDesplazamiento(dy, params, reducido);
        if (v !== 0) ref.current.obtenerDeslizador(s.id)?.((-v * dt) / 1000);
        guiaVertical(dy);
        cuadro = requestAnimationFrame(paso);
        return;
      }
      if (s.tipo !== "desplazando" || !objetivo) return;
      const dx = s.ultimo.x - s.origen.x;
      const dy = s.ultimo.y - s.origen.y;

      if (esLibre(objetivo)) {
        // HM-11: joystick libre (mapa). La vista avanza hacia donde apunta el pulgar.
        const vel = velocidadJoystick(dx, dy, params, reducido);
        const quieto = vel.vx === 0 && vel.vy === 0;
        const freno = apuntarEnMapa(objetivo, s, quieto, ahora);
        acumuladoX += (vel.vx * freno * dt) / 1000;
        acumulado += (vel.vy * freno * dt) / 1000;
        const ex = Math.trunc(acumuladoX);
        const ey = Math.trunc(acumulado);
        if (ex !== 0 || ey !== 0) {
          const movio = objetivo.mover(ex, ey) !== false;
          acumuladoX -= ex;
          acumulado -= ey;
          const borde = movio ? 0 : 1;
          if (borde !== 0 && enBorde === 0) vibrar(params.VIB_MS * 2);
          enBorde = borde;
        }
        const punto = puntoGuia.current;
        if (punto) {
          const escala = Number(punto.dataset.escala ?? 1);
          const d = Math.hypot(dx, dy);
          const k = d > params.R_MAX_DESPLAZAR ? params.R_MAX_DESPLAZAR / d : 1;
          punto.style.transform = `translate(calc(-50% + ${dx * k * escala}px), calc(-50% + ${dy * k * escala}px))`;
        }
        const raiz = indicador.current ?? puntoGuia.current?.parentElement;
        if (raiz) {
          const { angulo, llenado } = indicadorJoystick(dx, dy, params);
          raiz.dataset.direccion = angulo === null ? "quieto" : "libre";
          // CSS gira en sentido horario desde "arriba"; la geometría mide antihorario desde la derecha.
          if (angulo !== null) raiz.style.setProperty("--ba-giro", `${90 - angulo}deg`);
          raiz.style.setProperty("--ba-llenado", llenado.toFixed(3));
        }
        cuadro = requestAnimationFrame(paso);
        return;
      }

      // HM-12b: en "apuntar" la lista no corre por velocidad: salta de uno en uno.
      if (s.submodo === "apuntar") {
        apuntarEnLista(objetivo, s, ahora);
        cuadro = requestAnimationFrame(paso);
        return;
      }
      if (listaOrigen !== null) soltarFoco();

      const v = velocidadDesplazamiento(dy, params, reducido);
      acumulado += (v * dt) / 1000;
      const entero = Math.trunc(acumulado);
      if (entero !== 0) {
        const antes = posicion(objetivo);
        desplazar(objetivo, entero);
        acumulado -= entero;
        const movio = Math.abs(posicion(objetivo) - antes) >= 0.5;
        const borde = movio ? 0 : Math.sign(entero);
        // Vibración corta al llegar al inicio o al final (RF-18; solo Android, D-02).
        if (borde !== 0 && borde !== enBorde) vibrar(params.VIB_MS * 2);
        enBorde = borde;
      }
      guiaVertical(dy);
      cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    const ancla = indicador.current;
    return () => {
      cancelAnimationFrame(cuadro);
      if (ancla) {
        delete ancla.dataset.direccion;
        ancla.style.removeProperty("--ba-llenado");
        ancla.style.removeProperty("--ba-giro");
      }
      if (apuntadoAntes) ref.current.alApuntar(null);
      soltarFoco();
    };
  }, [activo, machine, params]);
}
