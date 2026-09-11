"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Crosshair } from "@phosphor-icons/react/dist/ssr";
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
}

interface LocationStepProps {
  initialValues: BusinessLocationValues;
  submitting: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (values: BusinessLocationValues) => void;
  onBack: () => void;
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
 * Sin selector de mapa interactivo a propósito: sección 17 de CLAUDE.md
 * pide expandir en el mismo lugar antes que construir pantallas nuevas,
 * pero un picker de mapa arrastrable es una pieza nueva por completo, no
 * una expansión — se reutiliza en cambio useConsumerGeolocation (ya
 * construido en la Épica F2/F3) como atajo, con los campos numéricos
 * siempre editables a mano para corregir la posición exacta del puesto.
 *
 * "Mostrar dirección exacta" vs. "zona aproximada" (ver CLAUDE.md) —
 * default `showExactLocation: false` en EMPTY_LOCATION
 * (business-registration-wizard.tsx), pedido explícito: protege por
 * defecto a un vendedor que opera desde su casa sin que tenga que saber
 * que la opción existe. Se puede cambiar después, cuando quiera, desde
 * el perfil del negocio (business-profile-screen.tsx) sin volver a
 * pasar por este formulario completo.
 */
export function LocationStep({ initialValues, submitting, error, fieldErrors, onSubmit, onBack }: LocationStepProps) {
  const geolocation = useConsumerGeolocation();
  const hasAutoFilled = useRef(false);

  const [type, setType] = useState<LocationType>(initialValues.type);
  const [referenceAddress, setReferenceAddress] = useState(initialValues.referenceAddress);
  const [latitude, setLatitude] = useState(initialValues.latitude);
  const [longitude, setLongitude] = useState(initialValues.longitude);
  const [showExactLocation, setShowExactLocation] = useState(initialValues.showExactLocation);

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
      setLatitude(geolocation.coords.lat.toFixed(6));
      setLongitude(geolocation.coords.lng.toFixed(6));
      return;
    }
    geolocation.retry();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ type, referenceAddress, latitude, longitude, showExactLocation });
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
          className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
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
      {geolocation.status === "denied" && (
        <p className="font-sans text-body-sm text-text-muted">
          No pudimos acceder a tu ubicación. Ingresa las coordenadas a mano abajo.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Latitud"
          type="number"
          inputMode="decimal"
          step="any"
          min={-90}
          max={90}
          required
          value={latitude}
          onChange={(event) => setLatitude(event.target.value)}
          error={fieldErrors.latitude}
        />
        <TextField
          label="Longitud"
          type="number"
          inputMode="decimal"
          step="any"
          min={-180}
          max={180}
          required
          value={longitude}
          onChange={(event) => setLongitude(event.target.value)}
          error={fieldErrors.longitude}
        />
      </div>

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
