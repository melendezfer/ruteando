"use client";

import { usePathname, useRouter } from "next/navigation";
import { Crosshair, Heart, MagnifyingGlass, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { useAnchorScreen } from "@boton-ancla/react";
import type { AnchorAction } from "@boton-ancla/core";
import { ANCHOR_SECTION_ICONS, SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

interface NavegacionAnclaProps {
  onCenterMap?: () => void;
  onBackToMap?: () => void;
  onSearch?: () => void;
  /** Hay una hoja abierta sobre el mapa: "Atrás" la cierra. */
  compact?: boolean;
}

/** Sección (centro del ancla) según la ruta. */
function seccion(pathname: string) {
  if (pathname === "/" || pathname === "/mapa") return { id: "mapa", icon: ANCHOR_SECTION_ICONS.map, label: "Mapa" };
  if (pathname === "/buscar") return { id: "buscar", icon: ANCHOR_SECTION_ICONS.search, label: "Buscar" };
  if (pathname === "/tablero") return { id: "tablero", icon: ANCHOR_SECTION_ICONS.vendorHome, label: "Mi negocio hoy" };
  if (pathname === "/perfil" || pathname === "/cuenta") return { id: "cuenta", icon: ANCHOR_SECTION_ICONS.account, label: "Mi cuenta" };
  if (pathname === "/negocios/nuevo") return { id: "registro", icon: ANCHOR_SECTION_ICONS.registration, label: "Registrar negocio" };
  if (/^\/negocios\/[^/]+\/ajustes$/.test(pathname)) return { id: "ajustes", icon: ANCHOR_SECTION_ICONS.businessSettings, label: "Ajustes del negocio" };
  if (pathname.startsWith("/negocios/")) return { id: "negocio", icon: ANCHOR_SECTION_ICONS.business, label: "Negocio" };
  if (pathname.startsWith("/legal/")) return { id: "legal", icon: ANCHOR_SECTION_ICONS.legal, label: "Textos legales" };
  return { id: pathname, icon: ANCHOR_SECTION_ICONS.map, label: "Ruteando" };
}

/**
 * Etapa I1 (docs/integracion-ancla.md, DI-03, DI-08): con el ancla encendida,
 * el ancla ocupa el lugar de la columna de navegación y ofrece lo mismo:
 * Buscar, Favoritos, Perfil y el mapa ("Mi ubicación" en el mapa, a 90° por
 * ser inofensiva; fuera del mapa, "Atrás" a 90° y "Mapa" como acción). El
 * resto de las capas y acciones por pantalla llega en I2–I5.
 */
export function NavegacionAncla({ onCenterMap, onBackToMap, onSearch, compact = false }: NavegacionAnclaProps) {
  const router = useRouter();
  const pathname = usePathname();
  const s = seccion(pathname);
  const irAlMapa = onBackToMap ?? (() => router.push("/mapa"));
  const enMapaVisible = Boolean(onCenterMap) && !compact;

  const acciones: AnchorAction[] = [
    {
      id: "buscar",
      label: "Buscar",
      icon: MagnifyingGlass,
      priority: 1,
      onSelect: onSearch ?? (() => router.push("/buscar")),
    },
    {
      id: "favoritos",
      label: "Favoritos",
      icon: Heart,
      priority: 2,
      onSelect: () => router.push("/mapa?favoritesOnly=true"),
    },
    { id: "perfil", label: "Perfil", icon: UserCircle, priority: 3, onSelect: () => router.push("/perfil") },
    enMapaVisible
      ? { id: "ubicarme", label: "Mi ubicación", icon: Crosshair, atTop: true, onSelect: onCenterMap! }
      : { id: "mapa", label: "Mapa", icon: SEMANTIC_ICONS.viewOnMap, priority: 4, onSelect: irAlMapa },
  ];

  useAnchorScreen({
    id: compact ? `${s.id}-hoja` : s.id,
    sectionIcon: s.icon,
    sectionLabel: s.label,
    // Fuera del mapa (o con una hoja abierta encima), 90° es "Atrás" (D-10, HM-14).
    ...(enMapaVisible
      ? {}
      : {
          back: {
            onSelect: compact
              ? irAlMapa
              : () => (window.history.length > 1 ? router.back() : router.push("/mapa")),
          },
        }),
    actions: acciones,
  });

  return null;
}
