"use client";

import { useEffect, useState } from "react";
import { Archive, Clock, Prohibit, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type BusinessStatus = NonNullable<components["schemas"]["Business"]["status"]>;

interface BusinessStatusBannerProps {
  businessId: string;
  status: BusinessStatus | null | undefined;
}

interface StatusContent {
  icon: Icon;
  classes: string;
  title: string;
  description: string;
}

// "active" no tiene entrada a propósito — es el estado normal, ya
// suficientemente visible en el resto del perfil (abre en el mapa/búsquedas,
// "Abierto ahora" arriba), sin necesitar un aviso aparte.
const STATUS_CONTENT: Record<Exclude<BusinessStatus, "active">, StatusContent> = {
  pending: {
    icon: Clock,
    classes: "border-ambar/40 bg-ambar/10 text-ambar",
    title: "Tu negocio está en revisión",
    description:
      "Un administrador todavía tiene que aprobarlo — hasta entonces no aparece en el mapa ni en las búsquedas.",
  },
  rejected: {
    icon: XCircle,
    classes: "border-rojo/40 bg-rojo/10 text-rojo",
    title: "Tu negocio fue rechazado",
    description: "Un administrador no lo aprobó. Corrige lo que corresponda y vuelve a contactarnos.",
  },
  suspended: {
    icon: Prohibit,
    classes: "border-rojo/40 bg-rojo/10 text-rojo",
    title: "Tu negocio está suspendido",
    description:
      "Un administrador lo suspendió — no aparece en el mapa ni en las búsquedas. Contáctanos si crees que fue un error.",
  },
  closed: {
    icon: Archive,
    classes: "border-border bg-surface text-text-muted",
    title: "Tu negocio está cerrado",
    description: "No aparece en el mapa ni en las búsquedas mientras esté en este estado.",
  },
};

/**
 * Aviso del estado del negocio, solo para el dueño (ver `isOwner` en
 * business-profile-screen.tsx) — hasta ahora (auditoría, punto 4)
 * `Business.status` nunca se mostraba en ningún lado del perfil: un
 * vendedor rechazado o todavía pendiente de aprobación no tenía ninguna
 * forma de saberlo desde la app, ni de ver por qué.
 *
 * `status` no es un dato sensible (viaja igual para cualquiera, ver
 * business.mapper.js) — el valor que llega por props, resuelto en el
 * Server Component, ya es el real. `rejectionReason` sí es exclusivo del
 * dueño (toApiBusinessProfile#esPropietario) y ese Server Component
 * corre sin el token del navegador (CLAUDE.md secciones 21/22), así que
 * la primera carga siempre trae `null` ahí aunque el negocio esté
 * "rejected" y quien mira sea el dueño real. Por eso, solo en ese caso,
 * este componente vuelve a pedir el negocio ya autenticado desde el
 * cliente (mismo `api` con el token en memoria, no uno nuevo) para
 * obtener el motivo real.
 */
export function BusinessStatusBanner({ businessId, status }: BusinessStatusBannerProps) {
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "rejected") return;

    let active = true;
    api
      .GET("/businesses/{businessId}", { params: { path: { businessId } } })
      .then(({ data }) => {
        if (active) setRejectionReason(data?.rejectionReason ?? null);
      })
      .catch(() => {
        // Best-effort: sin el motivo real, el aviso sigue mostrando el
        // texto genérico de "rejected" — no bloquea el resto del perfil.
      });
    return () => {
      active = false;
    };
  }, [businessId, status]);

  if (!status || status === "active") return null;

  const content = STATUS_CONTENT[status];
  const Icon = content.icon;

  return (
    <div className={`flex items-start gap-2 rounded-card border px-4 py-3 ${content.classes}`}>
      <Icon size={20} weight="fill" className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="font-sans text-body font-medium text-text">{content.title}</p>
        <p className="font-sans text-body-sm text-text-muted">{content.description}</p>
        {status === "rejected" && rejectionReason && (
          <p className="mt-1 font-sans text-body-sm text-text">
            <span className="font-medium">Motivo:</span> {rejectionReason}
          </p>
        )}
      </div>
    </div>
  );
}
