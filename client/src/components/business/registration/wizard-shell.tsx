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
  /**
   * "Guardar y terminar después" (pedido del usuario, 2026-09-29): siempre
   * visible, en todos los pasos — nunca atrapar al vendedor en un paso que
   * no puede completar en ese momento.
   */
  onSaveForLater?: () => void;
  savingForLater?: boolean;
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
export function WizardShell({
  title,
  stepLabel,
  progress,
  onClose,
  onSaveForLater,
  savingForLater = false,
  children,
}: WizardShellProps) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="reserva-columna flex flex-col gap-3 border-b border-border bg-surface py-4 pl-5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-muted hover:bg-background hover:text-text"
          >
            <X size={20} weight="bold" />
          </button>
          {onSaveForLater && (
            <button
              type="button"
              onClick={onSaveForLater}
              disabled={savingForLater}
              className="min-h-11 rounded-input px-2 font-sans text-body-sm font-semibold text-terracota hover:bg-terracota-50 disabled:opacity-60"
            >
              {savingForLater ? "Guardando…" : "Guardar y terminar después"}
            </button>
          )}
        </div>
        {stepLabel && <span className="font-sans text-body-sm font-medium text-text-muted">{stepLabel}</span>}

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

      <div className="reserva-columna flex flex-1 flex-col py-6 pl-5">{children}</div>
    </div>
  );
}
