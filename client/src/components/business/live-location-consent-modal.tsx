"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";

const LiveIcon = SEMANTIC_ICONS.liveLocation;
import { Button } from "@/components/ui/button";

interface LiveLocationConsentModalProps {
  accepting: boolean;
  error: string | null;
  onAccept: () => void;
  onClose: () => void;
}

/**
 * Consentimiento de "compartir mi ubicación en vivo" (migración
 * ubicacion-en-vivo, Ley 1581). Pedido explícito del usuario: el mensaje
 * explica PRIMERO por qué le conviene al vendedor activarlo (que los
 * clientes lo encuentren mientras se mueve), y después, sin esconderlo, qué
 * se comparte, cuándo, cuánto se guarda y cómo apagarlo — no un aviso
 * legal en seco. Mismo lenguaje visual que AccountDeletionRequestModal
 * (bottom sheet en celular, tarjeta centrada en pantallas anchas).
 */
export function LiveLocationConsentModal({ accepting, error, onAccept, onClose }: LiveLocationConsentModalProps) {
  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-location-consent-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-card bg-surface p-5 sm:rounded-card">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracota/10 text-terracota">
            <LiveIcon size={24} weight="bold" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-background"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <h2 id="live-location-consent-title" className="font-heading text-title-2 font-bold text-text">
          Que tus clientes te encuentren mientras te mueves
        </h2>
        <p className="font-sans text-body text-text">
          Con tu ubicación en vivo, tu punto en el mapa te sigue a donde vayas. Quien esté buscando lo que
          vendes cerca ve dónde estás ahora mismo y por dónde has pasado en los últimos 15 minutos — sin tener
          que escribirte para preguntar &quot;¿por dónde anda?&quot;. Más gente te encuentra en el camino, no
          solo en tu punto de siempre.
        </p>

        <div className="flex flex-col gap-2 rounded-card bg-background p-4">
          <p className="font-sans text-body-sm font-semibold text-text">Qué se comparte, y cuándo</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 font-sans text-body-sm text-text">
            <li>Tu ubicación exacta, solo mientras tengas RUTEANDO abierto en el celular.</li>
            <li>Solo dentro de tu horario o de tus franjas: cuando terminan, se apaga sola.</li>
            <li>Guardamos únicamente tu recorrido de los últimos 15 minutos. Nada más viejo.</li>
            <li>La apagas cuando quieras con un toque, y tu recorrido se borra en ese momento.</li>
          </ul>
        </div>

        <p className="font-sans text-caption text-text-muted">
          Tu ubicación en vivo es un dato personal (Ley 1581 de 2012). Solo la usamos para mostrarte en el mapa
          de RUTEANDO y no la entregamos a terceros. Más detalles en la{" "}
          <Link href="/legal/tratamiento-datos" className="text-terracota underline">
            política de tratamiento de datos
          </Link>
          .
        </p>

        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onAccept} loading={accepting}>
            Activar mi ubicación en vivo
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={accepting}>
            Ahora no
          </Button>
        </div>
      </div>
    </div>
  );
}
