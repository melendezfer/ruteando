"use client";

import { useEffect, useState } from "react";
import { confirmSellingNow, sellingNowExpiresAt, stopSellingNow } from "@/lib/api/selling-now";
import { getSellingNowErrorMessage } from "@/lib/api/error-messages";

const TICK_MS = 30_000;

/**
 * Estado y acciones de "Estoy vendiendo ahora" (R5) para el dueño. La
 * fuente de verdad es `confirmedAt` (Business.availabilityConfirmedAt),
 * que vive en la pantalla del perfil: así la tarjeta, la sugerencia bajo
 * la ubicación en vivo, el panel de preguntas y la insignia pública
 * muestran siempre lo mismo. El vencimiento (60 min) se calcula acá con
 * el reloj del navegador — la página del perfil se genera en el servidor
 * sin la sesión del vendedor, así que un campo "solo para el dueño" nunca
 * llegaría (ver la spec, sección 5.6).
 */
export function useSellingNow(
  businessId: string,
  confirmedAt: string | null,
  onChange: (confirmedAt: string | null) => void,
) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"confirm" | "stop" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const expiresAt = confirmedAt ? sellingNowExpiresAt(confirmedAt) : null;
  const active = expiresAt !== null && now < expiresAt;
  const minutesLeft = active && expiresAt !== null ? Math.max(1, Math.ceil((expiresAt - now) / 60_000)) : 0;

  async function confirm() {
    setBusy("confirm");
    setError(null);
    setNotice(null);
    const result = await confirmSellingNow(businessId);
    setBusy(null);
    setNow(Date.now());
    if (!result.ok || !result.confirmedAt) {
      setError(getSellingNowErrorMessage(result.status, result.problemType));
      return;
    }
    onChange(result.confirmedAt);
    setNotice(
      result.saved
        ? "Listo: tus clientes ya ven que estás vendiendo."
        : "Tu aviso ya estaba al día. Puedes renovarlo en unos minutos.",
    );
  }

  async function stop() {
    setBusy("stop");
    setError(null);
    setNotice(null);
    const result = await stopSellingNow(businessId);
    setBusy(null);
    if (!result.ok) {
      setError(getSellingNowErrorMessage(result.status));
      return;
    }
    onChange(null);
    setNotice("Listo: ya no apareces como vendiendo ahora.");
  }

  return { active, minutesLeft, busy, error, notice, confirm, stop };
}
