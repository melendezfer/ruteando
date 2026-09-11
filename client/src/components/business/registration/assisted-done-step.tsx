"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import type { components } from "@/lib/api/schema";

type AssistedRegistrationResult = components["schemas"]["AssistedRegistrationResult"];

interface AssistedDoneStepProps {
  result: AssistedRegistrationResult;
  onRegisterAnother: () => void;
}

/**
 * Resultado del registro asistido: el claimToken es de un solo uso y el
 * sistema nunca lo envía por ningún canal (openapi.yaml,
 * AssistedRegistrationResult) — el administrador tiene que copiarlo y
 * entregárselo al vendedor él mismo, por eso el botón de copiar es el
 * elemento central de esta pantalla, no un detalle secundario.
 */
export function AssistedDoneStep({ result, onRegisterAnother }: AssistedDoneStepProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!result.claimToken) return;
    try {
      await navigator.clipboard.writeText(result.claimToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles o navegador sin soporte — el token
      // sigue visible en pantalla para copiarlo a mano, no es un error
      // que bloquee el flujo.
    }
  }

  const expiresAt = result.claimTokenExpiresAt ? new Date(result.claimTokenExpiresAt) : null;

  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center">
      <CheckCircle size={48} weight="fill" className="text-verde" />
      <h1 className="font-heading text-title-1 font-bold text-text">
        {result.business?.name ?? "Negocio"} quedó registrado
      </h1>
      <p className="max-w-sm font-sans text-body text-text-muted">
        Entrégale este código a {result.user?.fullName ?? "el vendedor"} para que active su cuenta. Es de
        un solo uso{expiresAt ? ` y vence el ${expiresAt.toLocaleString("es-CO")}` : ""}.
      </p>

      <div className="flex w-full max-w-sm items-center gap-2 rounded-card border border-border bg-surface p-4">
        <code className="flex-1 overflow-x-auto whitespace-nowrap font-sans text-body text-text">
          {result.claimToken}
        </code>
        <Button type="button" variant="secondary" onClick={handleCopy} aria-label="Copiar código">
          <Copy size={18} weight="bold" />
        </Button>
      </div>
      {copied && <p className="font-sans text-body-sm text-verde">Copiado.</p>}

      <div className="flex w-full max-w-xs flex-col gap-3 pt-2">
        <Button type="button" onClick={onRegisterAnother} className="w-full">
          Hacer otro registro asistido
        </Button>
        <Link href="/">
          <Button type="button" variant="secondary" className="w-full">
            Ir al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
