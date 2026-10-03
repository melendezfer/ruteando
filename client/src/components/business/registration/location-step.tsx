"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Crosshair } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/discovery/skeleton";
import { CIUDAD_VERDE_CENTER } from "@/lib/geo/ciudad-verde";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import type { components } from "@/lib/api/schema";

type LocationType = components["schemas"]["LocationInput"]["type"];

export interface BusinessLocationValues {
  type: LocationType;
  referenceAddress: string;
  latitude: string;
  longitude: string;
  showExactLocation: boolean;
  /**
   * Si el vendedor ya ubicó su negocio (ubicación del celular, arrastrar o
   * tocar el mapa, o coordenadas a mano). Sin esto, el pin arranca en el
   * centro de Ciudad Verde y se guardaría un punto que nadie eligió.
   */
  placed: boolean;
}

const DraggablePinMap = dynamic(
  () => import("@/components/business/draggable-pin-map").then((mod) => mod.DraggablePinMap),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-card" /> },
);

export const MISSING_LOCATION_MESSAGE =
  "Falta ubicar tu negocio: arrastra el pin o toca el mapa donde vendes, o usa tu ubicación actual.";

interface LocationStepProps {
  initialValues: BusinessLocationValues;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: BusinessLocationValues) => void;
  onBack: () => void;
  /** Cada cambio, para "Guardar y terminar después" (lo guarda el asistente). */
  onValuesChange?: (values: BusinessLocationValues) => void;
}

// Mismo orden que tipo_ubicacion en CLAUDE.md (sección 5): fija | movil |
// puesto | local | desde_casa | temporal.
const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "fixed", label: "Fija" },
  { value: "mobile", label: "Móvil" },
  { value: "stall", label: "Puesto" },
  { value: "storefront", label: "Local" },
  { value: "home", label: "Desde casa" },
  { value: "temporary", label: "Temporal" },
];

/**
 * Paso 2 del asistente (RF-005): ubicación en la tabla `ubicaciones`, no
 * columnas sueltas en `negocios` (CLAUDE.md sección 6, Épica 2) — este
 * paso llama PUT /businesses/{id}/location, un endpoint aparte de
 * POST /businesses.
 *
 * Mapa con pin arrastrable (pedido del usuario, 2026-09-29): antes solo
 * había latitud/longitud a mano, y en el celular por la red local (sin
 * HTTPS) el navegador bloquea la ubicación, así que el vendedor quedaba
 * atrapado. La ubicación del celular es un atajo; las coordenadas quedan
 * plegadas como opción avanzada.
 *
 * "Mostrar dirección exacta" vs. "zona aproximada" (ver CLAUDE.md) —
 * default `showExactLocation: false` en EMPTY_LOCATION
 * (business-registration-wizard.tsx), pedido explícito: protege por
 * defecto a un vendedor que opera desde su casa sin que tenga que saber
 * que la opción existe. Se puede cambiar después, cuando quiera, desde
 * el perfil del negocio (business-profile-screen.tsx) sin volver a
 * pasar por este formulario completo.
 */
export function LocationStep({
  initialValues,
  submitting,
  error,
  fieldErrors,
  onSubmit,
  onBack,
  onValuesChange,
}: LocationStepProps) {
  const geolocation = useConsumerGeolocation();
  const hasAutoFilled = useRef(false);

  const [type, setType] = useState<LocationType>(initialValues.type);
  const [referenceAddress, setReferenceAddress] = useState(initialValues.referenceAddress);
  const [latitude, setLatitude] = useState(initialValues.latitude);
  const [longitude, setLongitude] = useState(initialValues.longitude);
  const [showExactLocation, setShowExactLocation] = useState(initialValues.showExactLocation);
  const [placed, setPlaced] = useState(initialValues.placed);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    onValuesChange?.({ type, referenceAddress, latitude, longitude, showExactLocation, placed });
  }, [type, referenceAddress, latitude, longitude, showExactLocation, placed, onValuesChange]);

  const latNum = Number(latitude);
  const lngNum = Number(longitude);
  const hasCoords = latitude !== "" && longitude !== "" && !Number.isNaN(latNum) && !Number.isNaN(lngNum);
  const pin = hasCoords ? { lat: latNum, lng: lngNum } : CIUDAD_VERDE_CENTER;

  function movePin(next: { lat: number; lng: number }) {
    setLatitude(next.lat.toFixed(6));
    setLongitude(next.lng.toFixed(6));
    setPlaced(true);
    setLocalError(null);
  }

  useEffect(() => {
    if (hasAutoFilled.current) return;
    if (initialValues.latitude || initialValues.longitude) return;
    if (geolocation.status !== "granted" || !geolocation.coords) return;

    const coords = geolocation.coords;
    // El `.then()` mueve el setState fuera de la fase síncrona del efecto
    // (mismo motivo documentado en use-geolocation.ts/home-screen.tsx,
    // react-hooks/set-state-in-effect) — sin esto, ESLint marca esta
    // llamada síncrona como un posible disparador de renders en cascada.
    let ignore = false;
    Promise.resolve().then(() => {
      if (ignore) return;
      hasAutoFilled.current = true;
      setLatitude(coords.lat.toFixed(6));
      setLongitude(coords.lng.toFixed(6));
      setPlaced(true);
    });
    return () => {
      ignore = true;
    };
    // Solo debe correr cuando la geolocalización pasa a "granted" — los
    // valores iniciales/actuales de latitude/longitude se leen adentro,
    // pero no deben disparar el efecto de nuevo (eso reescribiría lo que
    // el vendedor ya haya corregido a mano).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.status, geolocation.coords]);

  function handleUseCurrentLocation() {
    if (geolocation.status === "granted" && geolocation.coords) {
      movePin(geolocation.coords);
      return;
    }
    geolocation.retry();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!placed || !hasCoords) {
      setLocalError(MISSING_LOCATION_MESSAGE);
      return;
    }
    onSubmit({ type, referenceAddress, latitude, longitude, showExactLocation, placed });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="locationType" className="font-sans text-body-sm font-medium text-text">
          Tipo de ubicación
        </label>
        <select
          id="locationType"
          required
          value={type}
          onChange={(event) => setType(event.target.value as LocationType)}
          className="rounded-input border border-borde-control px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
        >
          {LOCATION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-card border border-border px-4 py-3">
        <legend className="px-1 font-sans text-body-sm font-medium text-text">
          Privacidad de tu ubicación
        </legend>
        <label className="flex items-start gap-2 font-sans text-body text-text">
          <input
            type="radio"
            name="showExactLocation"
            checked={!showExactLocation}
            onChange={() => setShowExactLocation(false)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Zona aproximada</span> (recomendado) — en el mapa se muestra tu
            manzana o conjunto, nunca el punto exacto.
          </span>
        </label>
        <label className="flex items-start gap-2 font-sans text-body text-text">
          <input
            type="radio"
            name="showExactLocation"
            checked={showExactLocation}
            onChange={() => setShowExactLocation(true)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Dirección exacta</span> — útil para un puesto fijo fácil de
            identificar en la calle.
          </span>
        </label>
      </fieldset>

      <TextField
        label="Referencia (opcional)"
        type="text"
        placeholder="Ej: frente al parque principal"
        maxLength={255}
        value={referenceAddress}
        onChange={(event) => setReferenceAddress(event.target.value)}
      />
      {!showExactLocation && (
        <p className="-mt-2 font-sans text-caption text-text-muted">
          Con zona aproximada elegida, evita escribir aquí el número exacto de apartamento o casa.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-sans text-body-sm font-medium text-text">Tu punto en el mapa</p>
        <p className="font-sans text-body-sm text-text-muted">
          {placed
            ? "Si no quedó justo donde vendes, arrastra el pin o toca el mapa."
            : "Arrastra el pin o toca el mapa donde vendes."}
        </p>
        <DraggablePinMap pin={pin} onPinChange={movePin} label="Mapa para ubicar tu negocio" />
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={handleUseCurrentLocation}
        loading={geolocation.status === "loading"}
        className="w-full justify-center gap-2"
      >
        <Crosshair size={18} weight="bold" />
        Usar mi ubicación actual
      </Button>
      {(geolocation.status === "denied" || geolocation.status === "unavailable") && (
        <p className="font-sans text-body-sm text-text-muted">
          Tu celular no nos dio la ubicación. No pasa nada: ubica el pin en el mapa.
        </p>
      )}

      <details className="rounded-card border border-border px-4 py-3">
        <summary className="cursor-pointer font-sans text-body-sm font-medium text-text-muted">
          Opciones avanzadas: coordenadas
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TextField
            label="Latitud"
            type="number"
            inputMode="decimal"
            step="any"
            min={-90}
            max={90}
            value={latitude}
            onChange={(event) => {
              setLatitude(event.target.value);
              setPlaced(true);
            }}
            error={fieldErrors.latitude}
          />
          <TextField
            label="Longitud"
            type="number"
            inputMode="decimal"
            step="any"
            min={-180}
            max={180}
            value={longitude}
            onChange={(event) => {
              setLongitude(event.target.value);
              setPlaced(true);
            }}
            error={fieldErrors.longitude}
          />
        </div>
      </details>

      {localError && <p className="font-sans text-body-sm text-rojo">{localError}</p>}
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      <div className="mt-auto flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onBack} className="flex-1">
          Atrás
        </Button>
        <Button type="submit" loading={submitting} className="flex-1">
          Continuar
        </Button>
      </div>
    </form>
  );
}
