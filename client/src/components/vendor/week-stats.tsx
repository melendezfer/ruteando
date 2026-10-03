"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Star } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type Stats = components["schemas"]["BusinessStats"];

/**
 * "Tu semana" (Perfil 2.0 §4.4): cuatro cifras de los últimos 7 días contra
 * los 7 anteriores. Solo cifras agregadas (GET /businesses/{id}/stats).
 */
export function WeekStats({ businessId }: { businessId: string }) {
  const [stats, setStats] = useState<Stats | null | undefined>(undefined);

  useEffect(() => {
    let ignore = false;
    api
      .GET("/businesses/{businessId}/stats", { params: { path: { businessId }, query: { days: 7 } } })
      .then(({ data }) => {
        if (!ignore) setStats(data ?? null);
      });
    return () => {
      ignore = true;
    };
  }, [businessId]);

  if (stats === undefined) {
    return <p className="font-sans text-body-sm text-text-muted">Cargando tu semana…</p>;
  }
  if (stats === null) {
    return <p className="font-sans text-body-sm text-text-muted">No pudimos cargar tu semana.</p>;
  }

  const { current, previous, pendingReviews } = stats;
  const sinDatos =
    current.profileViews === 0 && current.contacts === 0 && current.ratingCount === 0 && pendingReviews === 0;

  return (
    <div className="flex flex-col gap-2">
      {sinDatos && <p className="font-sans text-body-sm text-text-muted">Todavía no hay datos de esta semana.</p>}
      <dl className="grid grid-cols-2 gap-2">
        <Cifra titulo="Visitas al perfil" valor={current.profileViews} anterior={previous.profileViews} />
        <Cifra titulo="Contactos" valor={current.contacts} anterior={previous.contacts} ayuda="WhatsApp y Cómo llegar" />
        <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
          <dt className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">Calificación</dt>
          <dd className="flex items-center gap-1 font-heading text-title-2 font-bold text-text">
            {current.averageRating != null ? (
              <>
                <Star size={18} weight="fill" className="text-estrella" aria-hidden="true" />
                {current.averageRating.toFixed(1)}
              </>
            ) : (
              "—"
            )}
          </dd>
          <dd className="font-sans text-caption text-text-muted">
            {current.ratingCount} {current.ratingCount === 1 ? "calificación" : "calificaciones"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
          <dt className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">Reseñas por revisar</dt>
          <dd className="font-heading text-title-2 font-bold text-text">{pendingReviews}</dd>
          <dd className="font-sans text-caption text-text-muted">Las revisa el equipo de Ruteando</dd>
        </div>
      </dl>
    </div>
  );
}

function Cifra({ titulo, valor, anterior, ayuda }: { titulo: string; valor: number; anterior: number; ayuda?: string }) {
  const diferencia = valor - anterior;
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2">
      <dt className="font-sans text-caption font-medium uppercase tracking-wide text-text-muted">{titulo}</dt>
      <dd className="font-heading text-title-2 font-bold text-text">{valor}</dd>
      <dd className="flex items-center gap-1 font-sans text-caption text-text-muted">
        {diferencia > 0 && <ArrowUp size={12} weight="bold" className="text-verde-texto" aria-hidden="true" />}
        {diferencia < 0 && <ArrowDown size={12} weight="bold" className="text-ambar-texto" aria-hidden="true" />}
        {diferencia === 0
          ? "Igual que la semana pasada"
          : `${diferencia > 0 ? "+" : "−"}${Math.abs(diferencia)} vs. la semana pasada`}
      </dd>
      {ayuda && <dd className="font-sans text-caption text-text-muted">{ayuda}</dd>}
    </div>
  );
}
