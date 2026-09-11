"use client";

import type { ReactNode } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

interface WizardShellProps {
  title: string;
  /** "Paso X de N" — omitido en pantallas sin numeración (elección de modalidad, resultado final). */
  stepLabel?: string;
  /** 0-1. Solo se dibuja la barra si viene junto con stepLabel. */
  progress?: number;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Contenedor común del asistente de registro de negocio (Épica F5,
 * CLAUDE.md sección 18: "un solo objetivo por pantalla, con progreso
 * visible... sin la barra de navegación inferior durante el flujo").
 * Reemplaza a AppHeader mientras dura el asistente — un botón de cierre
 * (✕) en vez de la navegación Inicio/Mapa, para no competir con el
 * objetivo de la pantalla actual.
 */
export function WizardShell({ title, stepLabel, progress, onClose, children }: WizardShellProps) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text"
          >
            <X size={20} weight="bold" />
          </button>
          {stepLabel && <span className="font-sans text-body-sm font-medium text-text-muted">{stepLabel}</span>}
        </div>

        {progress !== undefined && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-terracota transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        <h1 className="font-heading text-title-1 font-bold text-text">{title}</h1>
      </div>

      <div className="flex flex-1 flex-col px-5 py-6">{children}</div>
    </div>
  );
}
