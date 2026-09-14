"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode as QrCodeIcon } from "@phosphor-icons/react/dist/ssr";

interface BusinessQrCodeProps {
  businessId: string;
  businessName: string;
}

/**
 * Código QR que apunta directo al perfil público del negocio
 * (/negocios/{businessId}) — petición directa del usuario, sin RF
 * asociado (ver CLAUDE.md). Solo visible para el dueño
 * (business-profile-screen.tsx), pensado para descargar/imprimir y
 * pegar en el puesto/carrito.
 *
 * Se genera enteramente en el navegador con la librería `qrcode` (única
 * dependencia nueva del proyecto para esto — se revisó primero que no
 * hubiera ninguna ya instalada), sin llamar a ningún servicio externo:
 * funciona sin conexión (coherente con la PWA instalable, CLAUDE.md
 * sección 12) y no depende de ningún endpoint nuevo del backend — la
 * URL que codifica ya es pública y accesible sin sesión, mismo motivo
 * por el que el perfil de negocio es un Server Component con Open Graph.
 *
 * `window.location.origin` (no una variable de entorno nueva) construye
 * la URL absoluta — funciona igual en desarrollo, en la LAN (sección 24
 * de CLAUDE.md), en staging y en producción sin configuración
 * adicional, y evita que el QR quede apuntando al dominio equivocado si
 * ese valor cambiara.
 */
export function BusinessQrCode({ businessId, businessName }: BusinessQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Este componente solo se monta del lado del cliente (isOwner en
  // business-profile-screen.tsx depende de useAuth(), que resuelve
  // después de la hidratación) — nunca se renderiza en el servidor, así
  // que leer `window` directamente acá, sin pasar por useEffect/useState,
  // es seguro y evita el round-trip de un render extra solo para llenar
  // este valor.
  const profileUrl = `${window.location.origin}/negocios/${businessId}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, profileUrl, { width: 220, margin: 2 }, (err) => {
      if (err) setError("No pudimos generar el código QR.");
    });
  }, [profileUrl]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${slugify(businessName)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin portapapeles disponible (ej. sin HTTPS, permiso denegado) —
      // no bloquea el resto de la funcionalidad, el enlace sigue
      // visible en texto para copiar a mano.
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <QrCodeIcon size={20} weight="duotone" className="text-terracota" />
        <p className="font-sans text-body font-medium text-text">Código QR de tu perfil</p>
      </div>
      <p className="font-sans text-body-sm text-text-muted">
        Descárgalo e imprímelo para pegarlo en tu puesto o carrito — cualquiera que lo escanee
        llega directo a tu perfil en Ruteando.
      </p>

      {error ? (
        <p className="font-sans text-body-sm text-rojo">{error}</p>
      ) : (
        <div className="flex justify-center rounded-input bg-white p-3">
          <canvas ref={canvasRef} />
        </div>
      )}

      <p className="break-all font-sans text-caption text-text-muted">{profileUrl}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!!error}
          className="flex h-btn flex-1 items-center justify-center gap-2 rounded-input bg-terracota font-sans text-button font-semibold text-white transition-colors hover:bg-terracota-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={18} weight="bold" />
          Descargar
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex h-btn flex-1 items-center justify-center rounded-input border border-border bg-surface font-sans text-button font-semibold text-text transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>
    </div>
  );
}

function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes tras la descomposición NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || "negocio";
}
