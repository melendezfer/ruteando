"use client";

import { useEffect, useState } from "react";
import { Question, XCircle } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

// "Confirmó que está vendiendo" — ícono propio (registro único), distinto
// de "abierto según su horario" y de "acción completada".
const ConfirmedSellingIcon = SEMANTIC_ICONS.confirmedSelling;
import {
  listPendingAvailabilityRequests,
  respondToAvailabilityRequest,
  type AvailabilityRequest,
} from "@/lib/api/availability";
import { formatAskedAgo } from "@/lib/availability/format-confirmed-at";
import { getRespondAvailabilityRequestErrorMessage } from "@/lib/api/error-messages";

interface VendorAvailabilityRequestsPanelProps {
  businessId: string;
  /** Se llama al confirmar — para que el resto del perfil (el badge del consumidor) se actualice sin recargar. */
  onConfirmed?: (confirmedAt: string) => void;
}

// Más espaciado que el polling del consumidor (5s, availability-request-button.tsx)
// — acá no hay nadie esperando en el momento, es solo "avisarme si llegó
// algo nuevo mientras tengo mi propio perfil abierto".
const POLL_INTERVAL_MS = 8000;

/**
 * Panel del vendedor para ver y responder sus propias solicitudes de
 * disponibilidad pendientes — Fase 3 de "vendiendo ahora" (sin RF
 * asociado, ver CLAUDE.md sección 11/37). Sin push todavía (Fase 6), así
 * que esto es la única forma real de responder hoy: el vendedor tiene
 * que tener su propio perfil abierto, sin depender de una notificación.
 *
 * Anonimizado a propósito, igual que BusinessFeedbackPanel: el backend
 * no expone quién preguntó (`AvailabilityRequest.userId` no resuelve a
 * un nombre desde ningún endpoint público), así que cada fila solo
 * puede decir "hace cuánto", nunca quién.
 */
export function VendorAvailabilityRequestsPanel({
  businessId,
  onConfirmed,
}: VendorAvailabilityRequestsPanelProps) {
  const [requests, setRequests] = useState<AvailabilityRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      const result = await listPendingAvailabilityRequests(businessId);
      if (active && result.ok) setRequests(result.requests);
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [businessId]);

  async function handleRespond(requestId: string, decision: "confirmed" | "declined") {
    setRespondingId(requestId);
    setError(null);
    const result = await respondToAvailabilityRequest(requestId, decision);
    setRespondingId(null);

    if (!result.ok) {
      setError(getRespondAvailabilityRequestErrorMessage(result.status));
    } else if (decision === "confirmed" && result.request?.respondedAt) {
      onConfirmed?.(result.request.respondedAt);
    }

    // Se responda bien o falle con 409 (ya no está pendiente — alguien
    // más la respondió, o expiró justo entre que se cargó la lista y se
    // tocó el botón), sacarla de acá: en ambos casos ya dejó de ser
    // algo que este panel pueda ofrecer responder.
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <p className="flex items-center gap-1.5 font-sans text-body font-medium text-text">
        <Question size={18} weight="bold" className="text-terracota" />
        Te preguntan si sigues vendiendo
      </p>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
      {requests.map(
        (req) =>
          req.id && (
            <div
              key={req.id}
              className="flex items-center justify-between gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <p className="font-sans text-body-sm text-text-muted">
                {req.createdAt ? formatAskedAgo(req.createdAt) : "Alguien te preguntó"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRespond(req.id!, "declined")}
                  disabled={respondingId === req.id}
                  aria-label="Declinar — no estoy vendiendo ahora"
                  className="flex h-9 w-9 items-center justify-center rounded-input border border-border text-rojo transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRespond(req.id!, "confirmed")}
                  disabled={respondingId === req.id}
                  aria-label="Confirmar que sigo vendiendo"
                  className="flex h-9 w-9 items-center justify-center rounded-input border border-border text-verde transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ConfirmedSellingIcon size={16} weight="bold" />
                </button>
              </div>
            </div>
          ),
      )}
    </div>
  );
}
