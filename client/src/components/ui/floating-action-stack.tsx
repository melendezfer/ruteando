import type { ReactNode } from "react";

export interface FloatingAction {
  icon: ReactNode;
  /** aria-label del botón/enlace — también su nombre accesible para pruebas. */
  label: string;
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
   * demás — así el caller puede condicionar una acción (ej. "centrar
   * mapa", solo con mapa visible) sin tener que recalcular qué queda
   * "grande" cuando falta: si el primero no-nulo cambia de una llamada a
   * otra, automáticamente hereda el tamaño grande.
   */
  actions: (FloatingAction | null)[];
}

/**
 * Ver CLAUDE.md, sección "FloatingActionStack" — esta es la única fuente
 * de verdad de su especificación (props, tamaños, colores); no
 * documentarla aparte. Nació en la Épica F4 para el perfil de negocio
 * (WhatsApp como principal, "Cómo llegar" como secundaria, dos acciones
 * fijas `primary`/`secondary`) y se generalizó después para el Mapa
 * (Épica F3). Redediseño de navegación global (sin RF asociado, petición
 * directa del usuario): `primary`/`secondary` (siempre exactamente 2
 * posiciones) se reemplazó por `actions` (un array de N, hoy hasta 4 en
 * la navegación global de Mapa/Buscar/Favoritos/Perfil) — mismo lenguaje
 * visual, sin límite fijo de posiciones. `BottomNavBar` (barra fija
 * horizontal) ya no existe en ningún lado del proyecto (redediseño de
 * navegación global) — este stack nunca necesita compensar espacio para
 * ella.
 */
export function FloatingActionStack({ actions }: FloatingActionStackProps) {
  const visible = actions.filter((action): action is FloatingAction => action != null);
  if (visible.length === 0) return null;

  return (
    <div className="fixed right-6 bottom-6 z-40 flex flex-col-reverse items-center gap-3">
      {visible.map((action, index) => (
        <FloatingActionButton
          key={action.label}
          action={action}
          className={
            index === 0
              ? "flex h-16 w-16 items-center justify-center rounded-full bg-terracota text-white shadow-xl transition-transform hover:scale-105"
              : "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg transition-transform hover:scale-105"
          }
        />
      ))}
    </div>
  );
}

function FloatingActionButton({ action, className }: { action: FloatingAction; className: string }) {
  if (action.href) {
    return (
      <a href={action.href} target="_blank" rel="noopener noreferrer" onClick={action.onClick} aria-label={action.label} className={className}>
        {action.icon}
      </a>
    );
  }

  return (
    <button type="button" onClick={action.onClick} aria-label={action.label} className={className}>
      {action.icon}
    </button>
  );
}
