"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { grantLiveLocationConsent, hasConsent } from "@/lib/api/consents";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";
import { LiveLocationConsentModal } from "@/components/business/live-location-consent-modal";

const LiveIcon = SEMANTIC_ICONS.liveLocation;

// El servidor descarta posiciones a menos de 10 s de la anterior
// (LIVE_LOCATION_MIN_INTERVAL_SECONDS); mandar cada 15 s deja margen y
// alcanza para un rastro legible de 15 minutos (~60 puntos). Y si el
// vendedor está quieto, watchPosition casi no dispara: el reenvío
// periódico mantiene la posición "fresca" (el servidor la deja de contar
// a los 2 minutos sin posiciones nuevas).
const SEND_INTERVAL_MS = 15_000;
const OFF_SCHEDULE_TYPE = /live-location-off-schedule$/;

type Status = "off" | "starting" | "on";

interface LiveLocationToggleProps {
  businessId: string;
  /** Avisa al perfil cuando cambia (para refrescar el pin propio si hace falta). */
  onChange?: (on: boolean) => void;
}

/**
 * "Compartir mi ubicación en vivo" — solo para el dueño de un negocio
 * ambulante (lo decide quien lo monta). Decisiones explícitas del
 * usuario: se comparte SOLO mientras la app está abierta (este componente
 * montado — al cerrar la app, el servidor deja de contarla sola a los 2
 * minutos), pide un consentimiento que explica el beneficio antes de la
 * primera vez, y se apaga sola al terminar el horario (409
 * live-location-off-schedule del servidor) o a mano, con un toque, que
 * además borra el recorrido en el acto (DELETE).
 *
 * Nada de esto se guarda en el navegador: ni la posición ni el estado del
 * interruptor (CLAUDE.md sección 13) — recargar la página lo deja apagado.
 */
export function LiveLocationToggle({ businessId, onChange }: LiveLocationToggleProps) {
  const [status, setStatus] = useState<Status>("off");
  const [message, setMessage] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const lastSendRef = useRef(0);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    watchIdRef.current = null;
    timerRef.current = null;
    lastPositionRef.current = null;
    lastSendRef.current = 0;
  }, []);

  // Al salir del perfil/cerrar la app: se deja de mandar (el servidor la
  // deja de mostrar sola a los 2 minutos). No se llama al DELETE acá: una
  // recarga accidental no debería borrar el recorrido que el cliente ya
  // estaba viendo.
  useEffect(() => stopWatching, [stopWatching]);

  const send = useCallback(
    async (position: GeolocationPosition) => {
      lastSendRef.current = Date.now();
      const { response, error } = await api.POST("/businesses/{businessId}/live-location", {
        params: { path: { businessId } },
        body: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      });
      if (response.ok) {
        setStatus("on");
        setLastSentAt(new Date());
        return;
      }
      stopWatching();
      setStatus("off");
      onChange?.(false);
      const type = (error as { type?: string } | undefined)?.type ?? "";
      if (response.status === 409 && OFF_SCHEDULE_TYPE.test(type)) {
        setMessage("Tu horario de hoy ya terminó, así que la ubicación en vivo se apagó sola.");
      } else if (response.status === 409) {
        setMessage("Solo un negocio ambulante puede compartir su ubicación en vivo.");
      } else if (response.status === 403 && /consent-required$/.test(type)) {
        setConsentOpen(true);
      } else {
        setMessage("No pudimos enviar tu ubicación. Intenta activarla de nuevo.");
      }
    },
    [businessId, onChange, stopWatching],
  );

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setMessage("Este navegador no permite compartir la ubicación.");
      return;
    }
    setMessage(null);
    setStatus("starting");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        lastPositionRef.current = position;
        if (Date.now() - lastSendRef.current >= SEND_INTERVAL_MS) void send(position);
      },
      () => {
        stopWatching();
        setStatus("off");
        setMessage("Necesitamos permiso de ubicación en este celular para compartirla en vivo.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000 },
    );
    timerRef.current = window.setInterval(() => {
      const position = lastPositionRef.current;
      if (position && Date.now() - lastSendRef.current >= SEND_INTERVAL_MS) void send(position);
    }, SEND_INTERVAL_MS);
    onChange?.(true);
  }, [onChange, send, stopWatching]);

  async function handleTurnOn() {
    setMessage(null);
    if (await hasConsent("live_location")) {
      startWatching();
    } else {
      setConsentError(null);
      setConsentOpen(true);
    }
  }

  async function handleAccept() {
    setAccepting(true);
    setConsentError(null);
    const { ok } = await grantLiveLocationConsent();
    setAccepting(false);
    if (!ok) {
      setConsentError("No pudimos guardar tu aceptación. Intenta de nuevo.");
      return;
    }
    setConsentOpen(false);
    startWatching();
  }

  async function handleTurnOff() {
    stopWatching();
    setStatus("off");
    setLastSentAt(null);
    onChange?.(false);
    const { response } = await api.DELETE("/businesses/{businessId}/live-location", {
      params: { path: { businessId } },
    });
    setMessage(response.ok ? "Listo: dejaste de compartir y tu recorrido se borró." : "Se apagó, pero no pudimos borrar tu recorrido. Intenta de nuevo.");
  }

  const on = status !== "off";

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-3">
        <LiveIcon size={20} weight="bold" className={on ? "text-terracota" : "text-text-muted"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-sans text-body text-text">Ubicación en vivo</span>
          <span className="font-sans text-caption text-text-muted">
            {status === "on"
              ? `Compartiendo · los clientes te ven en el mapa${lastSentAt ? ` (actualizada ${lastSentAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })})` : ""}`
              : status === "starting"
                ? "Buscando tu ubicación…"
                : "Que te encuentren mientras te mueves (solo con la app abierta)."}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Compartir mi ubicación en vivo"
          onClick={on ? handleTurnOff : handleTurnOn}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-terracota" : "bg-border"}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      {message && <p className="font-sans text-body-sm text-text-muted">{message}</p>}
      {consentOpen && (
        <LiveLocationConsentModal
          accepting={accepting}
          error={consentError}
          onAccept={handleAccept}
          onClose={() => setConsentOpen(false)}
        />
      )}
    </div>
  );
}
