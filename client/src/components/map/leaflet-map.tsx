"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type { components } from "@/lib/api/schema";
import { describeVariety } from "@/lib/zones/zone-format";
import { getCategoryPinColor } from "@/lib/map/category-pin-colors";

type Business = components["schemas"]["Business"];
type BusinessZone = components["schemas"]["BusinessZone"];

export interface BusinessPin extends Business {
  latitude: number;
  longitude: number;
}

// Mismo valor que ZONE_RADIUS_METERS en src/config/constants.js (backend)
// — acá es solo el radio del círculo que se DIBUJA alrededor del
// centroide de cada zona, no un parámetro real de clustering (eso ya lo
// hizo PostGIS). Duplicado a propósito, no importado de ningún lado
// compartido: frontend y backend son dos codebases separadas sin un
// paquete común, y este valor rara vez cambia.
const ZONE_CIRCLE_RADIUS_METERS = 200;

interface LeafletMapProps {
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  businesses: BusinessPin[];
  /** "Zonas de aglomeración" (ver CLAUDE.md sección 32) — resaltado visual, además de los pines individuales de siempre. */
  zones: BusinessZone[];
  /**
   * Qué pin debe verse "crecido" (`transform: scale()`, ver
   * `.f3-business-pin-inner--selected` en globals.css) — no es literalmente
   * "el seleccionado": el padre (map-screen.tsx) lo pone en `true` de
   * inmediato al tocar un pin (antes de abrir el popup de información)
   * y lo mantiene así mientras esa información sigue abierta, para que
   * el crecimiento no "parpadee" entre la animación de toque y la
   * selección real.
   */
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
  zones,
  selectedBusinessId,
  onSelectBusiness,
  onMapReady,
}: LeafletMapProps) {
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

      {/*
        "Zonas de aglomeración" (CLAUDE.md sección 32) — resaltado
        translúcido, no otro tipo de agrupación de pines (MarkerClusterGroup
        ya cubre eso, sin relación con esto: agrupa por proximidad de
        PÍXELES en pantalla según el zoom, no por proximidad geográfica
        real ni sabe nada de variedad de categorías). Se dibuja en el
        overlayPane de Leaflet, que por diseño queda DEBAJO del
        markerPane (z-index 400 vs. 600) sin importar el orden en el
        JSX — los pines individuales siguen siendo el objetivo de clic
        principal, esto es solo un resaltado de fondo.
      */}
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={[zone.centerLatitude ?? 0, zone.centerLongitude ?? 0]}
          radius={ZONE_CIRCLE_RADIUS_METERS}
          pathOptions={{
            color: "var(--color-mostaza)",
            weight: 2,
            fillColor: "var(--color-mostaza)",
            fillOpacity: 0.15,
          }}
        >
          <Tooltip direction="top" opacity={1}>
            {zone.businessCount} negocio{zone.businessCount === 1 ? "" : "s"} ·{" "}
            {describeVariety(zone.categoryCount ?? 0)}
          </Tooltip>
        </Circle>
      ))}

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
          <BusinessMarker
            key={business.id}
            business={business}
            icon={getBusinessIcon(getCategoryPinColor(business.categoryId))}
            selected={business.id === selectedBusinessId}
            onSelect={onSelectBusiness}
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

// Nombre del div INTERNO del ícono (ver createPinIcon) que recibe el
// `scale()` al seleccionar/tocar un pin — nunca el wrapper que
// `<Marker icon=.../>` controla directamente: ese wrapper es el mismo
// elemento que Leaflet reposiciona en cada pan/zoom con un
// `style="transform: translate3d(...)"` inline (verificado en
// node_modules/leaflet/dist/leaflet-src.js: `_initIcon` asigna nuestro
// `className` al mismo `_icon` que `_setPos`/`setPosition` mueve) — una
// regla CSS con `transform: scale()` ahí pisaría por completo esa
// traslación en vez de combinarse con ella, y el pin "saltaría" a otra
// posición del mapa en vez de crecer donde está.
const PIN_INNER_CLASS = "f3-business-pin-inner";
const SELECTED_PIN_CLASS = "f3-business-pin-inner--selected";

/**
 * Un pin individual, envuelto aparte de `businesses.map(...)` solo para
 * poder alternar la clase de "crecido" sobre el div interno del ícono
 * (`marker.getElement()?.querySelector(...)`) en vez de reemplazar el
 * ícono entero vía el prop `icon` de `<Marker>` — reemplazarlo llama a
 * `L.Marker#setIcon`, que borra el nodo e inserta uno nuevo, y una
 * transición CSS no tiene nada que animar entre dos nodos distintos
 * (verificado contra un navegador real: cambiar el ícono por
 * selección, como hacía este componente antes de esta funcionalidad,
 * pintaba el cambio de tamaño de golpe, sin transición, aunque la
 * regla CSS ya existiera). El `icon` en sí (forma + color) sigue
 * siendo estable mientras el negocio esté en el mapa — ver
 * `getBusinessIcon` más abajo.
 */
function BusinessMarker({
  business,
  icon,
  selected,
  onSelect,
}: {
  business: BusinessPin;
  icon: L.DivIcon;
  selected: boolean;
  onSelect: (business: BusinessPin) => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  // Memoizado a propósito: `position={[lat, lng]}` inline crearía un
  // array nuevo en CADA render de este componente — react-leaflet
  // compara `props.position` por referencia (@react-leaflet/core), así
  // que sin esto llamaría a `marker.setLatLng()` en cada re-render
  // (ej. al seleccionar otro negocio, o al abrir/cerrar filtros) aunque
  // las coordenadas no cambiaran un pixel. Encontrado depurando por qué
  // la clase de "crecido" desaparecía sola ~200ms después de aplicarse:
  // ese `setLatLng` redundante dispara el evento `move` del marcador,
  // que `leaflet.markercluster` usa para reubicarlo dentro del árbol de
  // clusters — reposicionarlo recrea su ícono desde `options.html`
  // (`L.DivIcon#createIcon`), perdiendo cualquier clase agregada a mano
  // sobre el DOM existente. Con la posición estable, `setLatLng` deja
  // de llamarse sin necesidad, y el problema desaparece en la raíz.
  const position = useMemo<[number, number]>(
    () => [business.latitude, business.longitude],
    [business.latitude, business.longitude],
  );

  useEffect(() => {
    // El `scale()` va en el div INTERNO (`.f3-business-pin-inner`), no en
    // `getElement()` directo — ver el comentario junto a createPinIcon.
    markerRef.current
      ?.getElement()
      ?.querySelector(`.${PIN_INNER_CLASS}`)
      ?.classList.toggle(SELECTED_PIN_CLASS, selected);
  }, [selected]);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      title={business.name}
      alt={business.name}
      eventHandlers={{ click: () => onSelect(business) }}
    />
  );
}

// Un ícono por color de categoría (ver category-pin-colors.ts), no por
// negocio ni por estado seleccionado — el color de un pin nunca cambia
// durante su vida en el mapa, así que cachearlos a nivel de módulo (no
// con useMemo: mutar el Map dentro de un hook de memoización dispara la
// regla "no reasignar después del render" del linter — acá no hace
// falta, es una caché de un valor puramente determinístico, sin
// relación con ningún ciclo de render) evita reconstruir el mismo SVG
// en cada render de la lista de negocios. El "crecimiento" al
// seleccionar/tocar un pin NO se resuelve creando un ícono distinto
// (eso reemplazaría el nodo DOM entero vía `marker.setIcon()` y la
// transición CSS no tendría de dónde animar) — ver BusinessMarker más
// abajo, que en cambio alterna una clase CSS sobre el mismo elemento.
const businessIconCache = new Map<string, L.DivIcon>();

function getBusinessIcon(color: string): L.DivIcon {
  let icon = businessIconCache.get(color);
  if (!icon) {
    icon = createPinIcon(color);
    businessIconCache.set(color, icon);
  }
  return icon;
}

function createPinIcon(color: string): L.DivIcon {
  const svg = `
    <div class="${PIN_INNER_CLASS}">
      <svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="${color}"/>
        <circle cx="15" cy="15" r="6" fill="#fff"/>
      </svg>
    </div>`;
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
