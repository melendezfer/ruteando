"use client";

import { useRouter } from "next/navigation";
import { Crosshair, Heart, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { FloatingActionStack, type FloatingAction } from "@/components/ui/floating-action-stack";

interface MainFloatingNavProps {
  /**
   * Solo con mapa visible en esta pantalla/modo — cuando no viene, el
   * acceso de "centrar/recentrar" se omite del stack (pedido explícito:
   * "se oculta cuando la pantalla actual no tiene mapa visible, ej.
   * dentro de Perfil o configuración"). Dentro de la propia pantalla de
   * mapa, también se omite cuando la vista de lista filtrada está
   * activa (`FilteredListSheet`) — ahí tampoco hay mapa visible, aunque
   * la ruta siga siendo `/mapa`.
   */
  onCenterMap?: () => void;
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
 * principales (Mapa/"/", Buscar, Favoritos y Perfil — más `/cuenta`, que
 * es "Perfil" para un vendedor con negocio activo, ver CLAUDE.md sección
 * 43) y en el selector de negocio (`VendorBusinessPicker`). Un solo
 * `FloatingActionStack` de hasta 4 accesos — el orden importa: el
 * primero no-nulo es el círculo grande (ver `FloatingActionStack`), así
 * que "centrar mapa" queda de primero para conservar el mismo lenguaje
 * visual que ya tenía el mapa (círculo grande = la acción más específica
 * del contexto); cuando no aplica, "Buscar" hereda el lugar grande solo
 * con quitar un elemento del array, sin lógica extra.
 *
 * Sin resaltado de "en qué pantalla estoy" (a diferencia de la vieja
 * `BottomNavBar`, que sí marcaba la pestaña activa) — mismo criterio ya
 * documentado para este componente (CLAUDE.md, "no expone un estado
 * activo distinto"); no se pidió agregarlo.
 */
export function MainFloatingNav({ onCenterMap, onSearch }: MainFloatingNavProps) {
  const router = useRouter();

  const actions: (FloatingAction | null)[] = [
    onCenterMap
      ? { icon: <Crosshair size={26} weight="fill" />, label: "Mi ubicación", onClick: onCenterMap }
      : null,
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
