"use client";

import { useRouter } from "next/navigation";
import { Crosshair, Heart, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";
import { useKeyboardOpen } from "@/lib/ui/use-keyboard-open";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";

interface MainFloatingNavProps {
  /** Solo con el mapa visible: agrega "Ubicarme" (centrar en mi ubicación) al final de la columna. */
  onCenterMap?: () => void;
  /**
   * En el mapa, con una hoja que lo tapa (búsqueda, resumen, lista): la
   * columna queda en un solo botón, "Volver al mapa", que cierra la hoja.
   */
  onBackToMap?: () => void;
  /** En el mapa, "Buscar" abre la hoja de búsqueda; en el resto, navega a `/buscar`. */
  onSearch?: () => void;
  /** Hay una hoja abierta encima: la columna se reduce a un solo botón. */
  compact?: boolean;
}

const ViewOnMapIcon = SEMANTIC_ICONS.viewOnMap;

/**
 * Navegación global (Etapa 1b, pedido del usuario 2026-10-03; reemplaza la
 * pila de círculos abajo a la derecha de CLAUDE.md §53/§54): una columna de
 * botones de 44 px al costado derecho, zona media-baja — Buscar, Favoritos,
 * Perfil y, con el mapa visible, Ubicarme. Arriba de cada pantalla solo van
 * "Volver" y el título (ScreenHeader), sin íconos de acción.
 *
 * Con una hoja o el teclado abiertos queda un solo botón: "Volver al mapa"
 * (que en el mapa cierra la hoja y fuera de él lleva a `/mapa`). Al
 * integrar el botón-ancla, el ancla ocupa este mismo lugar y reemplaza la
 * columna (docs/integracion-ancla.md §5).
 */
export function MainFloatingNav({ onCenterMap, onBackToMap, onSearch, compact = false }: MainFloatingNavProps) {
  const router = useRouter();
  const tecladoAbierto = useKeyboardOpen();

  if (compact || tecladoAbierto) {
    return (
      <FloatingActionStack
        showTip={false}
        actions={[
          {
            icon: <ViewOnMapIcon size={22} weight="fill" />,
            label: "Volver al mapa",
            shortLabel: "Mapa",
            onClick: onBackToMap ?? (() => router.push("/mapa")),
          },
        ]}
      />
    );
  }

  return (
    <FloatingActionStack
      actions={[
        {
          icon: <MagnifyingGlass size={22} weight="bold" />,
          label: "Buscar",
          shortLabel: "Buscar",
          onClick: onSearch ?? (() => router.push("/buscar")),
        },
        {
          // La lista de TODOS los favoritos (hoja del mapa), no solo los
          // abiertos ahora; ya no existe una pantalla "/favoritos".
          icon: <Heart size={22} weight="bold" />,
          label: "Favoritos",
          shortLabel: "Favoritos",
          onClick: () => router.push("/mapa?favoritesOnly=true"),
        },
        {
          icon: <UserCircle size={22} weight="bold" />,
          label: "Perfil",
          shortLabel: "Perfil",
          onClick: () => router.push("/perfil"),
        },
        onCenterMap
          ? { icon: <Crosshair size={22} weight="fill" />, label: "Mi ubicación", shortLabel: "Ubicarme", onClick: onCenterMap }
          : null,
      ]}
    />
  );
}
