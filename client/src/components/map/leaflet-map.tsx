"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import type { components } from "@/lib/api/schema";
import { describeVariety } from "@/lib/zones/zone-format";
import { resolveCategoryVisual, type CategoryVisual } from "@/lib/icons/category-icons";
import { MOBILITY_ICONS, MOBILITY_LABELS } from "@/lib/icons/semantic-icons";

type Business = components["schemas"]["Business"];
type BusinessZone = components["schemas"]["BusinessZone"];
type Category = components["schemas"]["Category"];
type Mobility = NonNullable<Business["mobility"]>;

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
  /** Categoría completa por id — el pin toma de acá su ÍCONO y su COLOR (`Category.icon`/`color`, guardados en la base). Una categoría todavía sin cargar cae al ícono y gris de respaldo (lib/icons/category-icons.ts). */
  categoriesById: Map<number, Category>;
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
  categoriesById,
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
        {businesses
          .filter((business) => business.liveLocation == null)
          .map((business) => (
            <BusinessMarker
              key={business.id}
              business={business}
              icon={getBusinessIcon(
                resolveCategoryVisual(business.categoryId != null ? categoriesById.get(business.categoryId) : undefined),
                business.mobility ?? "fixed",
                false,
              )}
              selected={business.id === selectedBusinessId}
              onSelect={onSelectBusiness}
            />
          ))}
      </MarkerClusterGroup>

      {/* Ambulantes compartiendo EN VIVO: fuera del MarkerClusterGroup a
          propósito — agrupados dentro de un círculo con un número, su
          anillo y su posición real quedaban ocultos justo cuando más
          importa verlos (encontrado verificando con Playwright). Siempre
          sueltos y por encima del resto (zIndexOffset). */}
      {businesses
        .filter((business) => business.liveLocation != null)
        .map((business) => (
          <BusinessMarker
            key={business.id}
            business={business}
            icon={getBusinessIcon(
              resolveCategoryVisual(business.categoryId != null ? categoriesById.get(business.categoryId) : undefined),
              business.mobility ?? "fixed",
              true,
            )}
            selected={business.id === selectedBusinessId}
            onSelect={onSelectBusiness}
            zIndexOffset={1000}
          />
        ))}

      {/* Rastro de un ambulante compartiendo en vivo: por dónde pasó en los
          últimos 15 minutos (el servidor no guarda más). Fuera del
          MarkerClusterGroup a propósito — una línea no se agrupa; debajo
          de los pines (overlayPane < markerPane). Mismo color de la
          categoría que su pin. */}
      {businesses.map((business) => {
        const trail = business.liveLocation?.trail ?? [];
        if (trail.length < 2) return null;
        const { color } = resolveCategoryVisual(
          business.categoryId != null ? categoriesById.get(business.categoryId) : undefined,
        );
        return (
          <Polyline
            key={`rastro-${business.id}`}
            positions={trail.map((p) => [p.latitude ?? 0, p.longitude ?? 0] as [number, number])}
            pathOptions={{ color, weight: 4, opacity: 0.55, dashArray: "2 8", lineCap: "round" }}
          />
        );
      })}
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

// Nombre del div INTERNO del ícono (ver getBusinessIcon) que recibe el
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
  zIndexOffset,
}: {
  business: BusinessPin;
  icon: L.DivIcon;
  selected: boolean;
  onSelect: (business: BusinessPin) => void;
  zIndexOffset?: number;
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
    // `getElement()` directo — ver el comentario junto a getBusinessIcon.
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
      zIndexOffset={zIndexOffset}
      title={pinTitle(business)}
      alt={pinTitle(business)}
      eventHandlers={{ click: () => onSelect(business) }}
    />
  );
}

/** Nombre accesible del pin: la modalidad y el "en vivo" no pueden depender solo del dibujo. */
function pinTitle(business: BusinessPin): string {
  const partes = [business.name ?? "Negocio", MOBILITY_LABELS[business.mobility ?? "fixed"]];
  if (business.liveLocation) partes.push("en vivo");
  return partes.join(" · ");
}

// Un ícono por combinación (ícono de categoría, color, modalidad, en
// vivo), no por negocio ni por estado seleccionado — nada de eso cambia
// mientras el pin sigue en el mapa, así que se cachea a nivel de módulo
// (no con useMemo: mutar el Map dentro de un hook de memoización dispara
// la regla "no reasignar después del render" del linter — acá es una
// caché de un valor puramente determinístico). El "crecimiento" al
// seleccionar NO crea un ícono distinto (reemplazaría el nodo y la
// transición CSS no tendría de dónde animar) — ver BusinessMarker.
const businessIconCache = new Map<string, L.DivIcon>();
// El SVG de cada ícono de Phosphor, una sola vez por (ícono, tamaño, color, peso).
const iconSvgCache = new Map<string, string>();

function iconSvg(Icon: CategoryVisual["Icon"], size: number, color: string, weight: "fill" | "bold"): string {
  const key = `${Icon.displayName ?? String(Icon)}|${size}|${color}|${weight}`;
  let svg = iconSvgCache.get(key);
  if (svg === undefined) {
    // renderToStaticMarkup (no un <Icon/> en el árbol de React): el pin lo
    // dibuja Leaflet a partir de un string de HTML (L.divIcon), fuera del
    // árbol de React.
    svg = renderToStaticMarkup(<Icon size={size} color={color} weight={weight} />);
    iconSvgCache.set(key, svg);
  }
  return svg;
}

/**
 * Pin rediseñado (PR 2 de 3): la gota siempre tiene la misma forma — lo
 * que identifica a la CATEGORÍA es su ícono (blanco, adentro) y su color
 * (relleno), ambos guardados en la base; la MODALIDAD es una marca chica
 * aparte (círculo blanco abajo a la derecha, ícono de
 * lib/icons/semantic-icons.ts: carrito / sombrilla / local) que nunca
 * reemplaza al ícono de la categoría. Un ambulante compartiendo en vivo
 * suma un anillo que pulsa (.f3-business-pin-inner--live, globals.css).
 */
function getBusinessIcon(visual: CategoryVisual, mobility: Mobility, live: boolean): L.DivIcon {
  const key = `${visual.Icon.displayName ?? String(visual.Icon)}|${visual.color}|${mobility}|${live}`;
  let icon = businessIconCache.get(key);
  if (!icon) {
    const html = `
    <div class="${PIN_INNER_CLASS}${live ? " f3-business-pin-inner--live" : ""}" style="--pin-color:${visual.color}">
      <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M17 1C8.2 1 1 8.2 1 17c0 11.6 16 26 16 26s16-14.4 16-26C33 8.2 25.8 1 17 1z" fill="${visual.color}" stroke="#fff" stroke-width="2"/>
      </svg>
      <span class="f3-pin-icon">${iconSvg(visual.Icon, 18, "#fff", "fill")}</span>
      <span class="f3-pin-mobility">${iconSvg(MOBILITY_ICONS[mobility], 11, "#1b1b1b", "bold")}</span>
    </div>`;
    icon = L.divIcon({
      html,
      className: "f3-business-pin",
      iconSize: [34, 44],
      iconAnchor: [17, 44],
    });
    businessIconCache.set(key, icon);
  }
  return icon;
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.4);"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
