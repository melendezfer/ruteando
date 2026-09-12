"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

interface BackButtonProps {
  /** A dónde ir si no hay una pantalla anterior en el historial de esta sesión (ej. el negocio se abrió desde un link compartido por WhatsApp). Default: Inicio. */
  fallbackHref?: string;
  className?: string;
}

/**
 * Botón "volver" fijo (bug real reportado por el usuario: el perfil de
 * negocio — y, por extensión, cualquier pantalla que no forme parte de la
 * navegación de Inicio/Mapa/Perfil de `AppHeader` — era un callejón sin
 * salida, más notorio todavía después de calificar un negocio, donde el
 * mensaje de agradecimiento queda más abajo en la página sin ninguna
 * acción para seguir). No se resolvió reusando `AppHeader` a propósito:
 * esta pantalla es alcanzable sin sesión (link de negocio compartido por
 * WhatsApp, CLAUDE.md sección 12) y `AppHeader` asume una sesión activa
 * (enlaces a Inicio/Mapa/Perfil detrás de `RequireAuth`, botón de cerrar
 * sesión) — un botón de volver liviano, sin esa suposición, es correcto
 * para cualquier visitante, con o sin cuenta.
 *
 * `router.back()` navega history-based (a Inicio o a Mapa, según de dónde
 * vino el usuario dentro de la app, tal como se pidió) — pero un link
 * compartido abierto directo no tiene una pantalla anterior DENTRO de
 * esta app en su historial (solo lo que haya antes en el navegador, ej.
 * WhatsApp), así que en ese caso `router.back()` saldría de la app en vez
 * de navegar dentro de ella. `window.history.length > 1` es una
 * heurística (Next.js App Router no expone su propio índice de
 * historial), no una garantía absoluta, pero cubre el caso real: llegar
 * navegando desde Inicio/Mapa dentro de la SPA acumula entradas de
 * historial > 1; abrir el link directo (o refrescar la página) dentro de
 * esta pestaña no.
 */
export function BackButton({ fallbackHref = "/", className = "" }: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Volver"
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-lg backdrop-blur transition-colors hover:bg-background ${className}`}
    >
      <ArrowLeft size={20} weight="bold" />
    </button>
  );
}
