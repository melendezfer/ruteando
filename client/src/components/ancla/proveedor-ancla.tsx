"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AnchorProvider, type AnchorTheme } from "@boton-ancla/react";
import "@/vendor/boton-ancla/react/anchor.css";
import { ANCHOR_ICONS } from "@/lib/icons/semantic-icons";
import {
  ANCLA_HABILITADA,
  guardarColocacion,
  useColocacionAncla,
  useModoAncla,
  type ModoAncla,
} from "@/lib/ancla/ancla-prefs";

// Tokens de RUTEANDO (D-19): el ancla no trae colores propios.
const TEMA: AnchorTheme = {
  accent: "var(--color-terracota)",
  surface: "var(--color-surface)",
  border: "var(--color-border)",
  text: "var(--color-text)",
  textMuted: "var(--color-text-muted)",
  // R14: --capa-ancla (1050): sobre las hojas del mapa (1000), bajo los modales (1100).
  zIndex: 1050,
};

/**
 * Altura de inicio del ancla: donde está la columna de navegación (zona
 * media-baja, docs/integracion-ancla.md §5.1, DI-08), para que encender el
 * ancla no mueva nada más. La columna termina a 18vh y mide ~200 px: su
 * centro queda a ~30 % del alto útil. La persona puede moverla después.
 */
// MARGEN_LATERAL: el centro del ancla queda a MARGEN_LATERAL + D_ACTIVO/2 del
// borde. Con el de fábrica (24 px) el ancla se metía en el contenido; con 8 px
// su círculo activo (64 px) ocupa justo la franja reservada de 72 px
// (--columna-franja, .reserva-columna).
const PARAMS = { ANCLA_ALTURA: 0.3, MARGEN_LATERAL: 8 };

const ContextoModo = createContext<ModoAncla>("apagado");

/** Modo del ancla en uso ("apagado" si no hay ancla). */
export function useAnclaModo(): ModoAncla {
  return useContext(ContextoModo);
}

/**
 * Etapa I1. Sin la bandera NEXT_PUBLIC_ANCLA: ni se monta (la app de
 * siempre). Con la bandera, el proveedor queda SIEMPRE montado, aunque el
 * modo sea "apagado": si se montara y desmontara al cambiar de modo, toda la
 * app se volvería a montar y perdería su estado (hallazgo al probarlo: la
 * pestaña de Configuración volvía al principio). En "apagado" ninguna
 * pantalla se registra (MainFloatingNav muestra la columna), así que el
 * ancla no se dibuja ni escucha toques; lo mismo en login o admin.
 */
export function ProveedorAncla({ children }: { children: ReactNode }) {
  const modo = useModoAncla();
  const colocacion = useColocacionAncla();

  if (!ANCLA_HABILITADA) {
    return <ContextoModo.Provider value="apagado">{children}</ContextoModo.Provider>;
  }

  const completo = modo === "completo";
  return (
    <ContextoModo.Provider value={modo}>
      <AnchorProvider
        prefs={{ hand: colocacion?.vertical.lado ?? "right" }}
        {...(colocacion ? { placement: colocacion } : {})}
        onPlacementChange={guardarColocacion}
        theme={TEMA}
        icons={ANCHOR_ICONS}
        params={PARAMS}
        desplazar={completo}
        desplazarLibre={completo}
        apuntar={completo}
      >
        {children}
      </AnchorProvider>
    </ContextoModo.Provider>
  );
}
