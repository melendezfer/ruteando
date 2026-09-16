"use client";

import { useEffect, useState } from "react";
import { CheckCircle, HourglassMedium, Question, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { requestAvailabilityCheck, getAvailabilityRequest } from "@/lib/api/availability";
import { getAvailabilityRequestErrorMessage } from "@/lib/api/error-messages";

interface AvailabilityRequestButtonProps {
  businessId: string;
  /** Se llama cuando el vendedor confirma — para que el perfil actualice el badge sin recargar la página. */
  onConfirmed?: (confirmedAt: string) => void;
}

type Stage =
  | { status: "idle" }
  | { status: "asking" }
  | { status: "pending"; requestId: string; expiresAt: string }
  | { status: "confirmed" }
  | { status: "declined" }
  | { status: "expired" }
  | { status: "error"; message: string };

// Ni tan seguido que sature al backend con una pregunta que dura hasta
// 10 min (AVAILABILITY_REQUEST_TTL_MINUTES), ni tan espaciado que se
// sienta lento una vez el vendedor sí responde.
const POLL_INTERVAL_MS = 5000;

/**
 * "¿Sigue vendiendo?" — Fase 2 de la confirmación de disponibilidad en
 * tiempo real (sin RF asociado, ver CLAUDE.md sección 11/37). Reusa
 * enteramente el backend de la sección 11 (POST .../availability-requests,
 * GET /availability-requests/{id}) — nada nuevo del lado del servidor.
 *
 * Sin push todavía (Fase 6, pendiente de credenciales de Firebase): la
 * única forma de saber si el vendedor ya respondió es este polling corto
 * mientras la solicitud sigue "pending" — buscado a propósito para no
 * depender de que el vendedor tenga la app abierta en el momento exacto
 * (eso lo resuelve el propio backend, best-effort, empujando un push si
 * algún día hay proveedor conectado).
 */
export function AvailabilityRequestButton({ businessId, onConfirmed }: AvailabilityRequestButtonProps) {
  const [stage, setStage] = useState<Stage>({ status: "idle" });

  useEffect(() => {
    if (stage.status !== "pending") return;

    let active = true;
    const { requestId, expiresAt } = stage;

    const interval = setInterval(async () => {
      const result = await getAvailabilityRequest(requestId);
      // Best-effort: un fallo puntual (ej. red intermitente) no rompe el
      // polling, simplemente lo reintenta en el próximo tick.
      if (!active || !result.ok || !result.request) return;

      const { status, respondedAt } = result.request;
      if (status === "confirmed") {
        setStage({ status: "confirmed" });
        if (respondedAt) onConfirmed?.(respondedAt);
      } else if (status === "declined") {
        setStage({ status: "declined" });
      } else if (status === "expired" || Date.now() > new Date(expiresAt).getTime()) {
        setStage({ status: "expired" });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [stage, onConfirmed]);

  async function handleAsk() {
    setStage({ status: "asking" });
    const result = await requestAvailabilityCheck(businessId);

    if (!result.ok || !result.request?.id || !result.request?.expiresAt) {
      setStage({ status: "error", message: getAvailabilityRequestErrorMessage(result.status) });
      return;
    }

    setStage({ status: "pending", requestId: result.request.id, expiresAt: result.request.expiresAt });
  }

  if (stage.status === "idle" || stage.status === "asking") {
    return (
      <Button type="button" variant="secondary" onClick={handleAsk} loading={stage.status === "asking"}>
        <Question size={18} weight="bold" />
        ¿Sigue vendiendo?
      </Button>
    );
  }

  if (stage.status === "pending") {
    return (
      <p className="flex items-center gap-2 font-sans text-body-sm text-text-muted">
        <HourglassMedium size={18} />
        Le preguntamos al vendedor — esperando respuesta…
      </p>
    );
  }

  if (stage.status === "confirmed") {
    return (
      <p className="flex items-center gap-2 font-sans text-body-sm font-medium text-verde">
        <CheckCircle size={18} weight="bold" />
        ¡Confirmó que sigue vendiendo!
      </p>
    );
  }

  if (stage.status === "declined") {
    return (
      <p className="flex items-center gap-2 font-sans text-body-sm text-text-muted">
        <XCircle size={18} weight="bold" />
        El vendedor indicó que no está vendiendo en este momento.
      </p>
    );
  }

  // "expired" o "error" — los dos únicos casos que ofrecen reintentar.
  return (
    <div className="flex flex-col gap-1">
      <p className="font-sans text-body-sm text-text-muted">
        {stage.status === "expired" ? "El vendedor no respondió a tiempo." : stage.message}
      </p>
      <Button type="button" variant="secondary" onClick={handleAsk}>
        <Question size={18} weight="bold" />
        Volver a preguntar
      </Button>
    </div>
  );
}
