"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, MapTrifold, Heart, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

interface Destination {
  href: string;
  label: string;
  icon: Icon;
}

/**
 * Los 4 destinos (CLAUDE.md sección 27, Documento 08 sección 5.3.1 — el
 * documento no está en este repositorio, así que esta lista se
 * reconstruyó a partir de lo que sí está documentado en CLAUDE.md/código
 * y se confirmó con el usuario antes de construir esto, en vez de
 * adivinarla). "Favoritos" pasa de ser una pestaña dentro de /perfil
 * (Épica F6) a su propio destino de primer nivel — sigue siendo de solo
 * lectura (marcar/desmarcar favoritos, RF-017/Épica F8, no está
 * construido todavía; ver `favorites-screen.tsx`).
 */
const DESTINATIONS: Destination[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/mapa", label: "Mapa", icon: MapTrifold },
  { href: "/favoritos", label: "Favoritos", icon: Heart },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
];

/**
 * Barra de navegación inferior de 4 destinos (CLAUDE.md sección 27) — fija
 * (`position: fixed`, no dentro del flujo normal, para no desaparecer al
 * hacer scroll, mismo motivo que ya llevó a `BackButton` a ser fijo en el
 * perfil de negocio). Reemplaza los enlaces de navegación que tenía
 * `AppHeader` (ahora solo branding + acciones secundarias, ver
 * `app-header.tsx`) — un solo lugar decide "dónde estoy", no dos
 * compitiendo.
 *
 * La pestaña activa se resuelve leyendo la URL actual (`usePathname()`),
 * no un prop que cada pantalla tenga que pasar y mantener sincronizado —
 * así es estructuralmente imposible que quede desincronizada de la ruta
 * real.
 *
 * Solo se monta dentro de `RequireAuth` en las 4 pantallas principales
 * (Inicio, Mapa, Favoritos, Perfil) — nunca en el perfil de negocio (ver
 * `BackButton`, alcanzable sin sesión), el asistente de registro
 * (`WizardShell` ya tiene su propia salida) ni las páginas legales
 * (`legal/layout.tsx` ya tiene su propio "Volver").
 */
export function BottomNavBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      {DESTINATIONS.map(({ href, label, icon: IconComponent }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-sans text-caption font-medium transition-colors ${
              active ? "text-terracota" : "text-text-muted hover:text-text"
            }`}
          >
            <IconComponent size={24} weight={active ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
