"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { PhoneVerificationPanel } from "@/components/business/phone-verification-panel";

interface DoneStepProps {
  businessName: string;
  businessId: string;
  contactPhone: string | null;
}

/**
 * Pantalla final del registro propio — el negocio queda en
 * estado_negocio = 'pendiente' (CLAUDE.md sección 6, Épica 2): no
 * prometer que ya es visible en el mapa/búsqueda hasta que un
 * administrador lo apruebe (Épica 9 backend / F9 frontend). Desde la
 * verificación de teléfono de vendedores (ver CLAUDE.md), la aprobación
 * del administrador ya no es la única condición — el teléfono también
 * tiene que quedar verificado, así que esta pantalla es el primer lugar
 * donde se pide (mismo panel que reaparece en el perfil del negocio si
 * se sale de acá sin verificarlo).
 */
export function DoneStep({ businessName, businessId, contactPhone }: DoneStepProps) {
  const [phoneVerified, setPhoneVerified] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <CheckCircle size={56} weight="fill" className="text-verde" />
      <h1 className="font-heading text-title-1 font-bold text-text">¡Listo, {businessName}!</h1>
      <p className="max-w-sm font-sans text-body text-text-muted">
        Registramos tu negocio con su ubicación y horario. Está pendiente de aprobación — te avisaremos
        cuando un administrador lo revise.
      </p>

      {!phoneVerified ? (
        <div className="w-full max-w-sm text-left">
          <PhoneVerificationPanel
            businessId={businessId}
            contactPhone={contactPhone}
            onVerified={() => setPhoneVerified(true)}
          />
        </div>
      ) : (
        <p className="max-w-sm font-sans text-body-sm text-verde">
          Teléfono verificado. En cuanto un administrador apruebe tu negocio, va a quedar visible en el
          mapa y las búsquedas.
        </p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3 pt-2">
        <Link href={`/negocios/${businessId}`}>
          <Button type="button" className="w-full">
            Ver mi negocio
          </Button>
        </Link>
        <Link href="/">
          <Button type="button" variant="secondary" className="w-full">
            Ir al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
