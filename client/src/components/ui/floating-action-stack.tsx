"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
          <FloatingActionButton key={action.label} action={action} principal={index === 0} />
        ))}
      </div>
    </>
  );
}

function FloatingActionButton({ action, principal }: { action: FloatingAction; principal: boolean }) {
  const circulo = principal
    ? "flex h-16 w-16 items-center justify-center rounded-full bg-terracota text-white shadow-xl"
    : "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg";
  const contenido = (
    <>
      {action.shortLabel && (
        <span className="rounded-full bg-surface/95 px-2.5 py-1 font-sans text-body-sm font-semibold text-text shadow-md">
          {action.shortLabel}
        </span>
      )}
      <span className={circulo}>{action.icon}</span>
    </>
  );
  // Los círculos chicos (48 px) se corren 8 px para quedar centrados sobre el grande (64 px).
  const fila = `flex items-center gap-2 transition-transform hover:scale-105 ${principal ? "" : "mr-2"}`;

  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" onClick={action.onClick} aria-label={action.label} className={fila}>
        {contenido}
      </a>
    );
  }

  return (
    <button type="button" onClick={action.onClick} aria-label={action.label} className={fila}>
      {contenido}
    </button>
  );
}
