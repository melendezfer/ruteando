"use client";

import { useState, type FormEvent } from "react";
import { ShieldWarning } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { getConfirmPhoneCodeErrorMessage, getSendPhoneCodeErrorMessage } from "@/lib/api/error-messages";

interface PhoneVerificationPanelProps {
  businessId: string;
  contactPhone: string | null;
  onVerified?: () => void;
}

type Stage = "idle" | "sent";

/**
 * Verificación de teléfono de vendedores (ver CLAUDE.md): mientras un
 * negocio no tenga el teléfono verificado, no aparece en el mapa ni en
 * las búsquedas (negocios.repository.js#listar/cercanos) — este panel es
 * lo único que puede resolver eso, y se reutiliza en dos lugares: al
 * final del asistente de registro (Épica F5, done-step.tsx) y en el
 * perfil de negocio, para el dueño, mientras siga sin verificar
 * (business-profile-screen.tsx).
 *
 * Sin envío automático al montar: cada envío cuenta contra el límite de
 * reenvíos del backend (3 cada 10 min), así que el primer paso siempre
 * es un clic explícito, no algo que dispare solo por abrir la pantalla
 * dos veces.
 */
export function PhoneVerificationPanel({ businessId, contactPhone, onVerified }: PhoneVerificationPanelProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);

    const { response } = await api.POST("/businesses/{businessId}/phone-verification", {
      params: { path: { businessId } },
    });

    setSending(false);

    if (!response.ok) {
      setError(getSendPhoneCodeErrorMessage(response.status));
      return;
    }

    setStage("sent");
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setConfirming(true);
    setError(null);

    const { response } = await api.POST("/businesses/{businessId}/phone-verification/confirm", {
      params: { path: { businessId } },
      body: { code },
    });

    setConfirming(false);

    if (!response.ok) {
      setError(getConfirmPhoneCodeErrorMessage(response.status));
      return;
    }

    onVerified?.();
  }

  if (!contactPhone) {
    return (
      <div className="rounded-card border border-ambar/40 bg-ambar/10 px-4 py-3">
        <p className="font-sans text-body-sm text-text">
          Este negocio todavía no tiene un teléfono de contacto registrado — agrégalo para poder
          verificarlo y que aparezca en el mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ambar/40 bg-ambar/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <ShieldWarning size={20} weight="fill" className="mt-0.5 shrink-0 text-ambar" />
        <div className="flex flex-col gap-0.5">
          <p className="font-sans text-body font-medium text-text">Verifica tu teléfono</p>
          <p className="font-sans text-body-sm text-text-muted">
            Tu negocio no aparece en el mapa ni en las búsquedas hasta que verifiques {contactPhone} por
            SMS.
          </p>
        </div>
      </div>

      {stage === "idle" && (
        <Button type="button" variant="secondary" onClick={handleSend} loading={sending}>
          Enviar código por SMS
        </Button>
      )}

      {stage === "sent" && (
        <form onSubmit={handleConfirm} className="flex flex-col gap-2">
          <TextField
            label="Código de 6 dígitos"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" loading={confirming} disabled={code.length !== 6} className="flex-1">
              Confirmar
            </Button>
            <Button type="button" variant="secondary" onClick={handleSend} loading={sending} className="flex-1">
              Reenviar código
            </Button>
          </div>
        </form>
      )}

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}
