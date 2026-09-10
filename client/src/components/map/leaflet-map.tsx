"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

export interface BusinessPin extends Business {
  latitude: number;
  longitude: number;
}

interface LeafletMapProps {
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  businesses: BusinessPin[];
  selectedBusinessId: string | null;
  onSelectBusiness: (business: BusinessPin) => void;
  /** Entrega la instancia real de L.Map apenas está lista — usada por el botón "Mi ubicación" para recentrar sin pasar por fitBounds. */
  onMapReady?: (map: L.Map) => void;
}

/**
 * Elegido Leaflet + react-leaflet sobre MapLibre GL para esta épica: el
 * caso de uso (pines + clustering sobre un mapa base) no necesita
 * renderizado vectorial WebGL, y Leaflet pesa una fracción de MapLibre
 * (~40 KB gzip del núcleo vs. ~200 KB+ de MapLibre) — coherente con la
 * restricción explícita de CLAUDE.md sección 12 sobre celulares de gama
 * baja. MapLibre además exige un proveedor de tiles vectoriales propio
 * (cuenta en MapTiler/Stadia o tile server autoalojado); Leaflet corre
 * directo contra los tiles raster públicos de OpenStreetMap, sin cuenta
 * ni backend adicional. El clustering usa leaflet.markercluster
 * (react-leaflet-cluster), el plugin más maduro del ecosistema Leaflet.
 *
 * Nunca se importa este archivo directamente desde un Server Component:
 * Leaflet toca `window`/`document` al cargarse, así que map-screen.tsx lo
 * carga con next/dynamic y `ssr: false`.
 *
 * Los íconos son SVG propios vía L.divIcon en vez de los PNG por defecto
 * de Leaflet — el bundling de esos PNG bajo webpack/Turbopack es un
 * problema conocido del ecosistema (rutas relativas al paquete que un
 * bundler no resuelve solo); un ícono propio evita el problema por
 * completo y de paso combina con los tokens de marca.
 */
export function LeafletMap({
  center,
  userLocation,
  businesses,
  selectedBusinessId,
  onSelectBusiness,
  onMapReady,
}: LeafletMapProps) {
  const businessIcon = useMemo(() => createPinIcon("var(--color-terracota)"), []);
  const selectedBusinessIcon = useMemo(() => createPinIcon("var(--color-mostaza)"), []);
  const userIcon = useMemo(() => createUserIcon(), []);

  return (
    // h-full/w-full solo funcionan acá porque map-screen.tsx envuelve
    // este componente en un `absolute inset-0` — un hijo en flujo normal
    // (esto, el div raíz de Leaflet) no resuelve `height:100%` de forma
    // confiable dentro de un contenedor cuyo alto viene de `flex-1`
    // directamente (ver el comentario en map-screen.tsx con el detalle,
    // encontrado verificando el mapa contra un navegador real).
    <MapContainer center={[center.lat, center.lng]} zoom={14} scrollWheelZoom className="h-full w-full">
      <FitToResults center={center} userLocation={userLocation} businesses={businesses} />
      <ExposeMapInstance onMapReady={onMapReady} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} zIndexOffset={1000} />
      )}

      <MarkerClusterGroup
        iconCreateFunction={(cluster) =>
          L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:var(--color-terracota);color:#fff;font-family:var(--font-sans, sans-serif);font-weight:600;font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);">${cluster.getChildCount()}</div>`,
            className: "f3-cluster-icon",
            iconSize: L.point(40, 40),
          })
        }
      >
        {businesses.map((business) => (
          <Marker
            key={business.id}
            position={[business.latitude, business.longitude]}
            icon={business.id === selectedBusinessId ? selectedBusinessIcon : businessIcon}
            title={business.name}
            alt={business.name}
            eventHandlers={{ click: () => onSelectBusiness(business) }}
          />
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}

/**
 * Encuadra el mapa para que TODOS los resultados actuales (más la
 * ubicación del usuario, si hay) queden visibles — sin esto, ampliar el
 * radio de búsqueda (o cualquier filtro que traiga negocios más lejanos)
 * seguía centrado en el zoom inicial y esos pines quedaban fuera del
 * viewport aunque existieran en el mapa (encontrado verificando el mapa
 * contra un navegador real, no solo compilando: al probar el filtro de
 * distancia de 10km, el negocio más lejano sembrado quedaba realmente
 * fuera de la vista, no solo "difícil de ver"). Sin resultados, vuelve al
 * centro por defecto (ubicación del usuario o el primer negocio).
 */
function FitToResults({
  center,
  userLocation,
  businesses,
}: {
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  businesses: BusinessPin[];
}) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = businesses.map((b) => [b.latitude, b.longitude]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);

    if (points.length === 0) {
      map.setView([center.lat, center.lng], map.getZoom());
      return;
    }

    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }, [map, businesses, userLocation, center.lat, center.lng]);

  return null;
}

/** Entrega la instancia de L.Map al padre apenas react-leaflet la crea — ver LeafletMapProps.onMapReady. */
function ExposeMapInstance({ onMapReady }: { onMapReady?: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  return null;
}

function createPinIcon(color: string): L.DivIcon {
  const svg = `
    <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="${color}"/>
      <circle cx="15" cy="15" r="6" fill="#fff"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "f3-business-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
  });
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.4);"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
