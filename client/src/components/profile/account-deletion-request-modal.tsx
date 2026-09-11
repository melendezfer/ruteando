"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

type AccountDeletionRequest = components["schemas"]["AccountDeletionRequest"];
type Reason = NonNullable<components["schemas"]["AccountDeletionRequestInput"]["reason"]>;

interface AccountDeletionRequestModalProps {
  onCancel: () => void;
  onSubmitted: (request: AccountDeletionRequest) => void;
}

const REASON_OPTIONS: { value: Reason; label: string }[] = [
  { value: "no_longer_needed", label: "Ya no lo necesito" },
  { value: "could_not_find_what_i_needed", label: "No encontré lo que buscaba" },
  { value: "technical_problem", label: "Tuve un problema técnico" },
  { value: "other", label: "Otro" },
];

/**
 * "Solicitar eliminación de mi cuenta y mis datos" (Configuración, Épica
 * F6) — ver CLAUDE.md. Encuesta de salida completamente opcional: las
 * cuatro opciones rápidas y el comentario libre nunca son obligatorios,
 * "Enviar solicitud" funciona igual sin tocar nada acá (POST
 * /users/me/account-deletion-request acepta un body vacío).
 *
 * La cuenta NO se elimina al enviar esto — solo queda registrada la
 * solicitud, visible para el equipo administrador (Épica 9) hasta que
 * la procese. El motivo/comentario se guardan separados de los datos
 * personales (usuario_id con ON DELETE SET NULL, ver la migración) para
 * que sirvan como retroalimentación de producto incluso después de que
 * la cuenta ya no exista.
 */
export function AccountDeletionRequestModal({ onCancel, onSubmitted }: AccountDeletionRequestModalProps) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const { data, response } = await api.POST("/users/me/account-deletion-request", {
      body: {
        reason: reason ?? undefined,
        comment: comment.trim() ? comment.trim() : undefined,
      },
    });

    setSubmitting(false);

    if (!response.ok || !data) {
      setError("No pudimos registrar la solicitud. Intenta de nuevo en un momento.");
      return;
    }

    onSubmitted(data);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-deletion-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-card bg-surface p-6 shadow-xl sm:rounded-card">
        <h2 id="account-deletion-modal-title" className="font-heading text-title-1 font-bold text-text">
          ¿Nos cuentas por qué te vas?
        </h2>
        <p className="font-sans text-body-sm text-text-muted">
          Totalmente opcional — puedes omitir esto y enviar la solicitud igual.
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Motivo (opcional)</legend>
          {REASON_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 font-sans text-body text-text">
              <input
                type="radio"
                name="deletionReason"
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
              />
              {option.label}
            </label>
          ))}
          {reason && (
            <button
              type="button"
              onClick={() => setReason(null)}
              className="self-start font-sans text-body-sm text-terracota underline"
            >
              Quitar selección
            </button>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="deletionComment" className="font-sans text-body-sm font-medium text-text">
            Cuéntanos más (opcional)
          </label>
          <textarea
            id="deletionComment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
          />
        </div>

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={submitting} className="flex-1">
            Enviar solicitud
          </Button>
        </div>
      </div>
    </div>
  );
}
