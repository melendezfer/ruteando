"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 1a (fix/pulido-visual): los letreros cortos solo se ven solos durante
 * las primeras LETREROS_VISITAS visitas (una visita = una sesión del
 * navegador); después, solo al mantener presionado (celular) o al pasar
 * el mouse (PC). El aria-label no depende de esto: siempre está.
 */
const LETREROS_VISITAS = 3;
const CLAVE_VISITAS = "ruteando.flotantes.visitas";
const CLAVE_SESION = "ruteando.flotantes.contada";
const PRESION_LARGA_MS = 450;

let visitasCache: number | null = null;

/** Cuenta la visita una sola vez por sesión; sin almacenamiento, trata cada carga como primera. */
function visitasActuales(): number {
  if (visitasCache !== null) return visitasCache;
  let visitas = 1;
  try {
    visitas = Number(window.localStorage.getItem(CLAVE_VISITAS) ?? "0") || 0;
    if (!window.sessionStorage.getItem(CLAVE_SESION)) {
      visitas += 1;
      window.localStorage.setItem(CLAVE_VISITAS, String(visitas));
      window.sessionStorage.setItem(CLAVE_SESION, "1");
    }
  } catch {
    visitas = 1;
  }
  visitasCache = visitas;
  return visitas;
}

export interface FloatingAction {
  icon: ReactNode;
  /** aria-label del botón/enlace — también su nombre accesible para pruebas. */
  label: string;
  /**
   * Nombre corto que se ve junto al círculo (A3, fix/pulido-visual): un
   * ícono solo (brújula, flecha) no se entendía. Una o dos palabras
   * ("Mapa", "Llegar"). Sin él, el círculo va solo.
   */
  shortLabel?: string;
  /** Si viene, la acción es un enlace externo (se abre en una pestaña nueva) — ej. wa.me, Google Maps. */
  href?: string;
  /** Si viene, la acción es un botón local (recentrar el mapa, navegar dentro de la app con el router, abrir un panel, etc). */
  onClick?: () => void;
}

interface FloatingActionStackProps {
  /**
   * De la más prominente a la menos prominente — el índice 0 (después de
   * quitar los `null`) es el círculo grande (h-16 w-16, terracota,
   * pegado a la esquina); el resto son círculos chicos (h-12 w-12, con
   * borde), apilados encima en el orden dado. Un `null` en cualquier
   * posición se omite sin dejar un hueco ni afectar el tamaño de los
   * demás.
   */
  actions: (FloatingAction | null)[];
  /**
   * A1 (fix/pulido-visual): por defecto el componente deja, donde está
   * montado (al final del contenido de la pantalla), un espacio vacío de
   * la altura real de los flotantes — así, con la página desplazada hasta
   * el final, nada queda debajo de ellos. `false` solo para pantallas que
   * no se desplazan (el mapa), donde ese espacio agregaría un scroll que
   * no existe.
   */
  reserveSpace?: boolean;
}

/** Distancia del stack al borde inferior (`bottom-6`) más un respiro. */
const MARGEN_INFERIOR_PX = 24 + 16;

/**
 * Ver CLAUDE.md, sección "FloatingActionStack" — esta es la única fuente
 * de verdad de su especificación (props, tamaños, colores).
 */
export function FloatingActionStack({ actions, reserveSpace = true }: FloatingActionStackProps) {
  const visible = actions.filter((action): action is FloatingAction => action != null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(0);
  const [letrerosSiempre, setLetrerosSiempre] = useState(false);

  useEffect(() => {
    // Se lee en el cliente (no en el render) para no desalinear la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLetrerosSiempre(visitasActuales() <= LETREROS_VISITAS);
  }, []);

  useEffect(() => {
    const el = stackRef.current;
    if (!el || !reserveSpace) return;
    const observer = new ResizeObserver(() => setAlto(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [reserveSpace, visible.length]);

  if (visible.length === 0) return null;

  return (
    <>
      {reserveSpace && <div aria-hidden="true" style={{ height: alto ? alto + MARGEN_INFERIOR_PX : 0 }} />}
      <div
        ref={stackRef}
        data-floating-action
        className="fixed right-6 bottom-6 z-40 flex flex-col-reverse items-end gap-3"
      >
        {visible.map((action, index) => (
          <FloatingActionButton
            key={action.label}
            action={action}
            principal={index === 0}
            letreroSiempre={letrerosSiempre}
          />
        ))}
      </div>
    </>
  );
}

function FloatingActionButton({
  action,
  principal,
  letreroSiempre,
}: {
  action: FloatingAction;
  principal: boolean;
  letreroSiempre: boolean;
}) {
  const [presionado, setPresionado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuePresionLarga = useRef(false);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  const empezarPresion = () => {
    fuePresionLarga.current = false;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      fuePresionLarga.current = true;
      setPresionado(true);
    }, PRESION_LARGA_MS);
  };
  const terminarPresion = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    // El letrero se queda un momento para que se alcance a leer al soltar.
    if (fuePresionLarga.current) {
      temporizador.current = setTimeout(() => setPresionado(false), 1500);
    }
  };
  const manejarClic = (event: React.MouseEvent) => {
    // Mantener presionado es para leer el letrero, no para activar la acción.
    if (fuePresionLarga.current) {
      event.preventDefault();
      fuePresionLarga.current = false;
      return;
    }
    action.onClick?.();
  };
  const eventosPresion = {
    onPointerDown: empezarPresion,
    onPointerUp: terminarPresion,
    onPointerLeave: terminarPresion,
    onPointerCancel: terminarPresion,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };

  const circulo = principal
    ? "flex h-16 w-16 items-center justify-center rounded-full bg-terracota text-white shadow-xl"
    : "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg";
  const contenido = (
    <>
      {action.shortLabel && (
        <span
          data-floating-label
          className={`${letreroSiempre || presionado ? "inline-block" : "hidden group-hover:inline-block"} rounded-full bg-surface/95 px-2.5 py-1 font-sans text-body-sm font-semibold text-text shadow-md select-none`}
        >
          {action.shortLabel}
        </span>
      )}
      <span className={circulo}>{action.icon}</span>
    </>
  );
  // Los círculos chicos (48 px) se corren 8 px para quedar centrados sobre el grande (64 px).
  const fila = `group flex items-center gap-2 select-none [-webkit-touch-callout:none] transition-transform hover:scale-105 ${principal ? "" : "mr-2"}`;

  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" onClick={manejarClic} aria-label={action.label} className={fila} {...eventosPresion}>
        {contenido}
      </a>
    );
  }

  return (
    <button type="button" onClick={manejarClic} aria-label={action.label} className={fila} {...eventosPresion}>
      {contenido}
    </button>
  );
}
