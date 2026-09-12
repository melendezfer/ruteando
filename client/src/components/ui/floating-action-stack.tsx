import type { ReactNode } from "react";

export interface FloatingAction {
  icon: ReactNode;
  /** aria-label del botón/enlace — también su nombre accesible para pruebas. */
  label: string;
  /** Si viene, la acción es un enlace (se abre en una pestaña nueva) — ej. wa.me, Google Maps. */
  href?: string;
  /** Si viene, la acción es un botón local (recentrar el mapa, abrir un panel, etc). */
  onClick?: () => void;
}

interface FloatingActionStackProps {
  /** Acción principal — círculo grande (h-16 w-16), terracota, la más cercana a la esquina. null la oculta sin dejar un hueco. */
  primary: FloatingAction | null;
  /** Acción secundaria — círculo más chico (h-12 w-12), con borde, apilada encima de la principal. */
  secondary?: FloatingAction | null;
  /**
   * true cuando la pantalla que llama también monta `BottomNavBar`
   * (CLAUDE.md sección 27) — sube el stack de `bottom-6` a `bottom-24`
   * para que la barra fija de navegación no le quede encima. Hoy solo
   * `MapScreen` combina las dos cosas (el perfil de negocio, el otro
   * lugar que usa este componente, nunca lleva `BottomNavBar` — ver
   * `BackButton`/CLAUDE.md sección 27).
   */
  aboveBottomNav?: boolean;
}

/**
 * Ver CLAUDE.md, sección "FloatingActionStack" — esta es la única fuente
 * de verdad de su especificación (props, tamaños, colores); no
 * documentarla aparte. Construido en la Épica F4 para el perfil de
 * negocio (WhatsApp como principal, "Cómo llegar" como secundaria) y
 * generalizado para el Mapa (Épica F3, fix/mapa-floating-action-stack:
 * "Mi ubicación" como principal, "Filtros" como secundaria) — mismo
 * componente en ambos casos, solo cambian los `FloatingAction` que
 * recibe.
 */
export function FloatingActionStack({ primary, secondary, aboveBottomNav = false }: FloatingActionStackProps) {
  if (!primary && !secondary) return null;

  return (
    <div
      className={`fixed right-6 z-40 flex flex-col items-center gap-3 ${aboveBottomNav ? "bottom-24" : "bottom-6"}`}
    >
      {secondary && (
        <FloatingActionButton
          action={secondary}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-terracota shadow-lg transition-transform hover:scale-105"
        />
      )}
      {primary && (
        <FloatingActionButton
          action={primary}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-terracota text-white shadow-xl transition-transform hover:scale-105"
        />
      )}
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
