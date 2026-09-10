"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretDown, CaretUp, MapPin, Star } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";

type Business = components["schemas"]["Business"];
type BusinessProfile = components["schemas"]["BusinessProfile"];

const TODAY_INDEX_TO_DAY: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

interface BusinessCardProps {
  business: Business;
  categoryName: string | null;
  /**
   * El mapa (Épica F3) llega acá con la tarjeta ya desplegada: tocar un
   * pin es en sí mismo la acción de "ver resumen" (Documento 08 §5.4.2),
   * no debería exigir un segundo toque para expandirla. La lista de
   * Inicio (Épica F2) no pasa esta prop y conserva su comportamiento
   * original (colapsada hasta que se toca).
   */
  defaultExpanded?: boolean;
}

/**
 * Tarjeta expandible in-place (CLAUDE.md sección 17: "una tarjeta de
 * negocio se despliega in-place para mostrar horario/reseñas rápidas, en
 * vez de abrir el perfil completo"). El perfil completo
 * (GET /businesses/{id}, BusinessProfile) se pide solo al expandir por
 * primera vez, no para cada resultado de la lista — mismo criterio que ya
 * separa Business de BusinessProfile en el contrato, para no desperdiciar
 * ancho de banda en cada búsqueda.
 *
 * El enlace "ver perfil completo" que menciona la sección 17 queda
 * deferido a la Épica F4 (la que construye esa pantalla) — enlazar hoy a
 * una ruta que todavía no existe sería peor que no ofrecerlo.
 */
export function BusinessCard({ business, categoryName, defaultExpanded = false }: BusinessCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!business.id) return;
    setLoadingProfile(true);
    const { data } = await api.GET("/businesses/{businessId}", {
      params: { path: { businessId: business.id } },
    });
    if (data) setProfile(data);
    setLoadingProfile(false);
  }, [business.id]);

  useEffect(() => {
    if (!defaultExpanded) return;
    // Solo al montar: si el negocio seleccionado cambia, el mapa vuelve a
    // montar esta tarjeta con un `key` distinto (ver map-screen.tsx), no
    // reutiliza esta instancia — no hace falta re-disparar por cambios de
    // props. El `.then()` mueve el setState inicial de loadProfile fuera
    // de la fase síncrona del efecto (mismo motivo que en home-screen.tsx,
    // react-hooks/set-state-in-effect).
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) loadProfile();
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && !profile) await loadProfile();
  }

  const todayDay = TODAY_INDEX_TO_DAY[new Date().getDay()];
  const todaySchedule = profile?.schedule?.find((entry) => entry.day === todayDay);
  const isOpenToday = Boolean(todaySchedule && !todaySchedule.closed && todaySchedule.openTime && todaySchedule.closeTime);

  return (
    <div className="rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-title-2 font-semibold text-text">{business.name}</span>
          <span className="font-sans text-body-sm text-text-muted">
            {categoryName ?? "Comida callejera"}
            {typeof business.distanceMeters === "number" ? ` · ${formatDistance(business.distanceMeters)}` : ""}
          </span>
        </div>
        {expanded ? (
          <CaretUp size={20} className="shrink-0 text-text-muted" />
        ) : (
          <CaretDown size={20} className="shrink-0 text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          {loadingProfile && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {!loadingProfile && profile && (
            <>
              <p className="flex items-center gap-1.5 font-sans text-body-sm text-text">
                <MapPin size={16} className="text-terracota" />
                {isOpenToday ? `Hoy: ${todaySchedule!.openTime} – ${todaySchedule!.closeTime}` : "Cerrado hoy"}
              </p>
              <p className="flex items-center gap-1.5 font-sans text-body-sm text-text">
                <Star size={16} weight="fill" className="text-mostaza" />
                {profile.averageRating != null
                  ? `${profile.averageRating.toFixed(1)} (${profile.reviewCount} reseña${profile.reviewCount === 1 ? "" : "s"})`
                  : "Todavía sin reseñas"}
              </p>
            </>
          )}

          {!loadingProfile && !profile && (
            <p className="font-sans text-body-sm text-text-muted">No pudimos cargar más detalles ahora mismo.</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
