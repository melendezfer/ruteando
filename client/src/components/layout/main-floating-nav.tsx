"use client";

import { useRouter } from "next/navigation";
import { Compass, Crosshair, Heart, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { FloatingActionStack, type FloatingAction } from "@/components/ui/floating-action-stack";

interface MainFloatingNavProps {
  /**
   * Solo con mapa visible en esta pantalla/modo — con mapa, el círculo
   * grande es "Mi ubicación" (centrar/recentrar). Sin este prop (el
   * caso de todas las demás pantallas: Perfil, Buscar, Cuenta, el
   * selector de negocio, el perfil de un negocio, y dentro del propio
   * Mapa mientras un sheet tapa la vista), el círculo grande pasa a ser
   * "Volver al mapa" — hallazgo real reportado por el usuario: quitar
   * "centrar mapa" sin dar un reemplazo dejaba a cualquier pantalla sin
   * mapa sin ninguna forma de regresar a la pantalla principal.
   */
  onCenterMap?: () => void;
  /**
   * Handler a medida para "Volver al mapa" cuando la ruta actual YA es
   * el mapa pero algo lo está tapando (`BusinessSummarySheet`,
   * `MapSearchSheet`, la lista filtrada) — ahí "volver" significa
   * cerrar ese overlay, no navegar (un `router.push("/mapa")` estando
   * ya en esa ruta no hace nada). Sin este prop, el fallback navega de
   * verdad a `/mapa` — el caso de cualquier pantalla que no sea el
   * mapa.
   */
  onBackToMap?: () => void;
  /**
   * En Mapa, "Buscar" abre la hoja de búsqueda local (`MapSearchSheet`,
   * sin cambiar de ruta) — en el resto de las pantallas, navega a
   * `/buscar` (default de este componente cuando no se pasa nada).
   */
  onSearch?: () => void;
}

/**
 * Redediseño de navegación global (sin RF asociado, petición directa del
 * usuario): reemplaza a `AppHeader` + `BottomNavBar` en las 4 pantallas
 * principales (Mapa/"/", Buscar, Favoritos y Perfil — más `/cuenta`, el
 * selector de negocio y el perfil de un negocio). Un solo
 * `FloatingActionStack` de 4 accesos — el orden importa: el primero es
 * siempre el círculo grande (ver `FloatingActionStack`), y a diferencia
 * de la primera versión de este componente, ya NUNCA se omite del todo:
 * o es "Mi ubicación" (con mapa visible) o es "Volver al mapa" (sin él) —
 * ver `onCenterMap`/`onBackToMap`.
 *
 * Sin resaltado de "en qué pantalla estoy" (a diferencia de la vieja
 * `BottomNavBar`, que sí marcaba la pestaña activa) — mismo criterio ya
 * documentado para este componente (CLAUDE.md, "no expone un estado
 * activo distinto"); no se pidió agregarlo.
 */
export function MainFloatingNav({ onCenterMap, onBackToMap, onSearch }: MainFloatingNavProps) {
  const router = useRouter();

  const mapAction: FloatingAction = onCenterMap
    ? { icon: <Crosshair size={26} weight="fill" />, label: "Mi ubicación", onClick: onCenterMap }
    : {
        icon: <Compass size={26} weight="fill" />,
        label: "Volver al mapa",
        onClick: onBackToMap ?? (() => router.push("/mapa")),
      };

  const actions: (FloatingAction | null)[] = [
    mapAction,
    {
      icon: <MagnifyingGlass size={22} weight="bold" />,
      label: "Buscar",
      onClick: onSearch ?? (() => router.push("/buscar")),
    },
    {
      icon: <UserCircle size={22} weight="bold" />,
      label: "Perfil",
      onClick: () => router.push("/perfil"),
    },
    {
      // "Favoritos" navega a la misma vista de lista filtrada que el
      // ícono de sección del banner de Mapa (ver CLAUDE.md, discovery-banner.tsx)
      // — TODOS los favoritos, no solo los abiertos ahora, ordenados por
      // distancia. Ya no existe una pestaña/pantalla "/favoritos"
      // separada — decisión explícita del usuario.
      icon: <Heart size={20} weight="bold" />,
      label: "Favoritos",
      onClick: () => router.push("/mapa?favoritesOnly=true"),
    },
  ];

  return <FloatingActionStack actions={actions} />;
}
