"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

interface DraggablePinMapProps {
  pin: { lat: number; lng: number };
  onPinChange: (pin: { lat: number; lng: number }) => void;
  /** Etiqueta accesible del mapa. */
  label: string;
  className?: string;
}

/**
 * Mapa chico con un pin que se arrastra o se mueve tocando el mapa (asistente
 * de registro, paso de ubicación). Mismo lenguaje que el editor del pin de
 * Ajustes (location-pin-editor.tsx). Solo navegador: se importa con
 * `next/dynamic({ ssr: false })` porque Leaflet toca `window` al cargar.
 */
export function DraggablePinMap({ pin, onPinChange, label, className = "h-56" }: DraggablePinMapProps) {
  const icon = useMemo(() => createPinIcon(), []);
  return (
    <div role="region" aria-label={label} className={`w-full overflow-hidden rounded-card ${className}`}>
      <MapContainer center={[pin.lat, pin.lng]} zoom={16} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FollowPin pin={pin} />
        <TapToMove onPinChange={onPinChange} />
        <Marker
          position={[pin.lat, pin.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onPinChange({ lat, lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}

/** Si el pin cambia desde afuera (ubicación actual, coordenadas a mano), el mapa lo sigue. */
function FollowPin({ pin }: { pin: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (!map.getBounds().contains([pin.lat, pin.lng])) map.setView([pin.lat, pin.lng]);
  }, [map, pin.lat, pin.lng]);
  return null;
}

function TapToMove({ onPinChange }: { onPinChange: DraggablePinMapProps["onPinChange"] }) {
  useMapEvents({ click: (event) => onPinChange({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    html: `
    <div class="text-terracota">
      <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="currentColor"/>
        <circle cx="15" cy="15" r="6" fill="#fff"/>
      </svg>
    </div>`,
    className: "",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}
