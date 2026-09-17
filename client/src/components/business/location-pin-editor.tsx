"use client";

import { useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { Crosshair } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { getBusinessFormErrorMessage } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type Location = components["schemas"]["Location"];
type LocationType = NonNullable<components["schemas"]["LocationInput"]["type"]>;

interface LocationPinEditorProps {
  businessId: string;
  location: {
    type: LocationType;
    referenceAddress: string | null | undefined;
    latitude: number;
    longitude: number;
    showExactLocation: boolean;
  };
  onSaved: (location: Location) => void;
}

/**
 * Ajustar manualmente la ubicación del negocio en el mapa (sin RF
 * asociado, petición directa del usuario — ver CLAUDE.md): un vendedor
 * ambulante, o alguien que atiende desde la entrada de un conjunto
 * residencial, no siempre queda bien representado por la ubicación que
 * se capturó al registrarse (geolocalización del navegador,
 * `location-step.tsx`). Nada nuevo del lado del backend:
 * `PUT /businesses/{businessId}/location` ya existía completo (Épica 2)
 * y ya inserta una fila de historial nueva por cada llamada — este
 * control solo cambia `latitude`/`longitude`, preservando `type`/
 * `referenceAddress`/`showExactLocation` tal cual venían (decisión
 * confirmada con el usuario antes de implementar: el tipo de ubicación
 * y la dirección de referencia se siguen editando donde ya se editaban,
 * no acá — este control es solo "ajustar el punto").
 *
 * Sin guardado automático al arrastrar (decisión confirmada con el
 * usuario) — cada PUT inserta una fila nueva en `ubicaciones` (nunca
 * sobrescribe), así que guardar en cada pixel de un arrastre llenaría
 * el historial de filas ruidosas. El pin se mueve libremente y solo se
 * confirma con "Guardar nueva ubicación".
 *
 * `navigator.geolocation.getCurrentPosition` se llama acá directo, sin
 * reusar `useConsumerGeolocation` (`lib/geo/use-geolocation.ts`) — ese
 * hook pide el permiso automáticamente al montar, pensado para el mapa
 * de descubrimiento; acá el dueño ya tiene una ubicación guardada
 * siempre, así que pedir el permiso sin que lo pida explícitamente
 * (tocando "Usar mi ubicación actual") sería una interrupción sin
 * ningún beneficio la mayoría de las veces que se abre esta pantalla.
 */
export function LocationPinEditor({ businessId, location, onSaved }: LocationPinEditorProps) {
  const [pin, setPin] = useState<{ lat: number; lng: number }>({
    lat: location.latitude,
    lng: location.longitude,
  });
  const [saving, setSaving] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const icon = useMemo(() => createDraggablePinIcon(), []);
  const dirty = pin.lat !== location.latitude || pin.lng !== location.longitude;

  function handleUseCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Tu navegador no permite compartir tu ubicación actual.");
      return;
    }
    setError(null);
    setGettingCurrentLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGettingCurrentLocation(false);
        setPin({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setGettingCurrentLocation(false);
        setError("No pudimos acceder a tu ubicación — revisa el permiso de ubicación del navegador.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  function handleCancel() {
    setPin({ lat: location.latitude, lng: location.longitude });
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const { response, data } = await api.PUT("/businesses/{businessId}/location", {
      params: { path: { businessId } },
      body: {
        type: location.type,
        referenceAddress: location.referenceAddress ?? undefined,
        latitude: pin.lat,
        longitude: pin.lng,
        showExactLocation: location.showExactLocation,
      },
    });

    setSaving(false);

    if (!response.ok || !data) {
      setError(getBusinessFormErrorMessage(response.status));
      return;
    }

    onSaved(data);
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-3">
      <p className="font-sans text-body font-medium text-text">Ajustar ubicación en el mapa</p>
      <p className="font-sans text-body-sm text-text-muted">
        Arrastra el pin hasta donde realmente atiendes — útil si eres ambulante o si atiendes desde un
        punto distinto al que quedó registrado.
      </p>

      <div className="h-56 w-full overflow-hidden rounded-card">
        <MapContainer center={[pin.lat, pin.lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker
            position={[pin.lat, pin.lng]}
            icon={icon}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker;
                const { lat, lng } = marker.getLatLng();
                setPin({ lat, lng });
              },
            }}
          />
        </MapContainer>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handleUseCurrentLocation}
        loading={gettingCurrentLocation}
        className="justify-center gap-2"
      >
        <Crosshair size={18} weight="bold" />
        Usar mi ubicación actual
      </Button>

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      {dirty && (
        <div className="flex gap-2">
          <Button type="button" onClick={handleSave} loading={saving} className="flex-1 justify-center">
            Guardar nueva ubicación
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={saving}
            className="flex-1 justify-center"
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

// Mismo color de marca que el resto del sistema de diseño (--color-terracota,
// hoy violeta #5B3DF5 — ver globals.css) vía `currentColor`, en vez de un
// hex propio: si el acento vuelve a cambiar, este ícono lo sigue sin
// tocarse.
function createDraggablePinIcon(): L.DivIcon {
  const svg = `
    <div class="text-terracota">
      <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="currentColor"/>
        <circle cx="15" cy="15" r="6" fill="#fff"/>
      </svg>
    </div>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}
