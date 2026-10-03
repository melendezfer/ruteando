"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Letreros de los flotantes (pedido del usuario, 2026-09-29): NUNCA se
 * muestran solos. Solo aparecen al mantener presionado (táctil) o al pasar
 * el mouse / enfocar con teclado (PC). La primera vez que alguien abre la
 * app, un único aviso pequeño lo explica y se cierra con un toque. El
 * aria-label está siempre.
 *
 * Antes (1a) se mostraban solos en las "primeras 3 visitas", contadas por
 * sesión del navegador: en el celular una pestaña o la PWA vive días con la
 * misma sesión (y el contador es distinto por dirección: localhost y la IP
 * de la red local cuentan aparte), así que en la práctica casi nunca pasaba
 * de 3 y los letreros tapaban media pantalla. El aviso es pequeño, vive en la
 * franja de la columna y se cierra con cualquier toque.
 */
const PRESION_LARGA_MS = 450;
const CLAVE_AVISO = "ruteando.flotantes.aviso-visto";

let avisoVistoCache: boolean | null = null;

function avisoYaVisto(): boolean {
  if (avisoVistoCache !== null) return avisoVistoCache;
  try {
    avisoVistoCache = window.localStorage.getItem(CLAVE_AVISO) === "1";
  } catch {
    // Sin almacenamiento no hay cómo recordarlo: no se insiste.
    avisoVistoCache = true;
  }
  return avisoVistoCache;
}

function marcarAvisoVisto() {
  avisoVistoCache = true;
  try {
    window.localStorage.setItem(CLAVE_AVISO, "1");
  } catch {
    // nada que hacer
  }
}

export interface FloatingAction {
  icon: ReactNode;
  /** aria-label del botón/enlace — también su nombre accesible para pruebas. */
  label: string;
  /**
   * Nombre corto que aparece al mantener presionado (táctil) o al pasar el
   * mouse (PC). Una o dos palabras ("Buscar", "Ubicarme").
   */
  shortLabel?: string;
  /** Si viene, la acción es un enlace externo (se abre en una pestaña nueva). */
  href?: string;
  /** Si viene, la acción es un botón local (recentrar el mapa, navegar con el router, abrir un panel). */
  onClick?: () => void;
}

interface FloatingActionStackProps {
  /**
   * De arriba hacia abajo. Un `null` en cualquier posición se omite sin
   * dejar hueco.
   */
  actions: (FloatingAction | null)[];
  /** `false` para no mostrar el aviso de la primera vez (ej. con una hoja abierta encima). */
  showTip?: boolean;
}

/**
 * Columna de navegación (Etapa 1b, pedido del usuario 2026-10-03; ver
 * docs/specs/perfil-2.md §8.1 y docs/integracion-ancla.md §5): una sola
 * columna de botones compactos de 44 px, fija al costado derecho en la
 * zona media-baja — alcance del pulgar y el mismo lugar que ocupará el
 * botón-ancla, que la reemplazará ahí. Sin letreros a la vista: el nombre
 * aparece solo al mantener presionado. El contenido de cada pantalla
 * reserva la franja derecha (`.reserva-columna`, globals.css) para que
 * nada quede debajo. Quien la monta decide cuándo reducirla a un solo
 * botón (hoja o teclado abiertos, MainFloatingNav).
 */
export function FloatingActionStack({ actions, showTip = true }: FloatingActionStackProps) {
  const visible = actions.filter((action): action is FloatingAction => action != null);
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const tieneLetreros = showTip && visible.some((action) => action.shortLabel);

  useEffect(() => {
    // Se lee en el cliente (no en el render) para no desalinear la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tieneLetreros) setMostrarAviso(!avisoYaVisto());
  }, [tieneLetreros]);

  useEffect(() => {
    if (!mostrarAviso) return;
    const cerrar = () => {
      marcarAvisoVisto();
      setMostrarAviso(false);
    };
    document.addEventListener("pointerdown", cerrar, { capture: true });
    return () => document.removeEventListener("pointerdown", cerrar, { capture: true });
  }, [mostrarAviso]);

  if (visible.length === 0) return null;

  return (
    <div
      data-floating-action
      className="pointer-events-none fixed z-(--capa-flotantes) flex flex-col items-end gap-2 *:pointer-events-auto"
      style={{ right: "var(--columna-borde)", bottom: "var(--columna-abajo)" }}
    >
      {/* Aviso de la primera vez (pedido del usuario, 2026-10-03): pequeño,
          dentro de la franja reservada (no tapa contenido), sin bloquear
          toques, y se cierra con cualquier toque en la pantalla. */}
      {mostrarAviso && tieneLetreros && (
        <p
          data-floating-tip
          role="status"
          className="pointer-events-none! w-13 rounded-card bg-text px-1 py-1 text-center font-sans text-[11px] leading-tight text-white shadow-md"
        >
          Mantén pulsado para ver el nombre
        </p>
      )}
      {visible.map((action) => (
        <FloatingActionButton key={action.label} action={action} />
      ))}
    </div>
  );
}

function FloatingActionButton({ action }: { action: FloatingAction }) {
  const [presionado, setPresionado] = useState(false);
  // Mouse encima o foco con teclado (PC). En táctil NO: ahí el :hover queda
  // "pegado" después de un toque; por eso no se usa group-hover de CSS.
  const [senalado, setSenalado] = useState(false);
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
    onPointerEnter: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") setSenalado(true);
    },
    onPointerLeave: (event: React.PointerEvent) => {
      if (event.pointerType === "mouse") setSenalado(false);
      terminarPresion();
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      if (event.currentTarget.matches(":focus-visible")) setSenalado(true);
    },
    onBlur: () => setSenalado(false),
    onPointerCancel: terminarPresion,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  };

  const circulo =
    "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg";
  const contenido = (
    <>
      {action.shortLabel && (
        <span
          data-floating-label
          className={`${presionado || senalado ? "inline-block" : "hidden"} rounded-full bg-surface/95 px-2.5 py-1 font-sans text-body-sm font-semibold text-text shadow-md select-none`}
        >
          {action.shortLabel}
        </span>
      )}
      <span className={circulo}>{action.icon}</span>
    </>
  );
  const fila =
    "flex items-center gap-2 select-none [-webkit-touch-callout:none] transition-transform hover:scale-105";

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
