"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type L from "leaflet";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { useAuth } from "@/lib/auth/auth-context";
import { useConsumerGeolocation } from "@/lib/geo/use-geolocation";
import { useBusinessSearch } from "@/lib/discovery/use-business-search";
import { Skeleton } from "@/components/discovery/skeleton";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { MapSearchSheet, type MapFiltersState } from "@/components/map/map-search-sheet";
import { BusinessSummarySheet } from "@/components/map/business-summary-sheet";
import { ZoneComparisonCard } from "@/components/map/zone-comparison-card";
import { DiscoveryBanner } from "@/components/map/discovery-banner";
import { FilteredListSheet, type DiscoveryListFilter } from "@/components/map/filtered-list-sheet";
import type { DiscoveryOffer } from "@/components/discovery/offer-row";
import { sortAvailableNow } from "@/lib/discovery/available-now";
import type { BusinessPin } from "@/components/map/leaflet-map";
import type { CatalogType } from "@/lib/catalog/catalog-label";

type Category = components["schemas"]["Category"];
type BusinessZone = components["schemas"]["BusinessZone"];
type OfferType = components["schemas"]["OfferType"];

// Centro de referencia de Ciudad Verde, Soacha (mismo punto que usa
// scripts/seedLoadTest.js en el backend) — solo se usa cuando el
// consumidor no concede geolocalización y todavía no hay ningún negocio
// real para calcular un centro a partir de sus coordenadas.
const DEFAULT_CENTER = { lat: 4.578, lng: -74.217 };
const MAP_RESULTS_LIMIT = 50;
const DEFAULT_MAP_RADIUS_KM = 5;
const LOCATE_ME_ZOOM = 16;
// Banner de descubrimiento, familia "Disponibles ahora" (Fase 1, sin RF
// asociado — petición directa del usuario): tope propio, chico a
// propósito para un carrusel horizontal — no tiene sentido pedir 50
// negocios como el resto del mapa para mostrarlos deslizando de a uno.
const DISCOVERY_BANNER_LIMIT = 15;
// Debe coincidir con la duración de la transición de
// `.f3-business-pin-inner` en globals.css — el popup de información
// (BusinessSummarySheet) se abre recién cuando el pin terminó de
// crecer, no al tocar.
const PIN_GROW_ANIMATION_MS = 220;

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((mod) => mod.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Skeleton className="h-full w-full rounded-none" />
    </div>
  ),
});

/**
 * Vista de mapa (Épica F3, redediseño de navegación global — sin RF
 * asociado, petición directa del usuario, ver CLAUDE.md): pines
 * agrupados contra GET /businesses/nearby (o GET /businesses sin
 * geolocalización). Los controles no son una barra fija arriba del mapa
 * — `MainFloatingNav` (navegación global de las 4 pantallas principales,
 * reemplaza a `AppHeader`+`BottomNavBar`) los agrupa junto con "centrar
 * mapa", exclusivo de esta pantalla. El logo "Ruteando", fijo abajo a la
 * izquierda, es marca estática (sin acción) — también exclusivo de esta
 * pantalla, no de la navegación global.
 *
 * "Buscar" (dentro de `MainFloatingNav`) abre `MapSearchSheet` en vez de
 * navegar a `/buscar` — reemplaza a lo que hasta la Fase B de la
 * retroalimentación sobre el buscador (sin RF asociado — ver CLAUDE.md
 * sección 51) eran DOS superficies separadas: una caja de texto fija
 * arriba del mapa (Fase 1, sección 45) y un botón "Filtros" aparte
 * (distancia/precio/abierto-ahora, también Fase 1) — ahora las dos viven
 * juntas en un solo bottom sheet.
 */
interface MapScreenProps {
  /**
   * "Ver en el mapa" desde /buscar (Fase 4 de la fusión de buscadores,
   * sin RF asociado — ver CLAUDE.md sección 45/49): id del negocio a
   * centrar/seleccionar apenas el mapa esté listo. Viene de
   * `?businessId=` en la URL (/mapa/page.tsx), no de un state que este
   * componente conozca por su cuenta.
   */
  initialBusinessId?: string;
  /**
   * Redediseño de navegación global (sin RF asociado, petición directa
   * del usuario): los tres tipos de filtro que puede traer la URL al
   * llegar desde un ícono tappable — categoría de una fila del banner
   * (`?categoryId=`), tipo de oferta con vigencia del badge de
   * `ProductRow` (`?offerTypeId=`, generaliza lo que antes era un filtro
   * de pines con aviso removible, PR #78) o "todos mis favoritos"
   * (`?favoritesOnly=true`, ícono de sección del banner o de
   * `MainFloatingNav`). A diferencia de `initialBusinessId` (solo centra
   * el mapa una vez), esto abre `FilteredListSheet` — una vista de lista
   * vertical de pantalla completa, no un filtro sobre los pines.
   */
  initialListFilter?: DiscoveryListFilter;
}

export function MapScreen({ initialBusinessId, initialListFilter }: MapScreenProps) {
  const { user } = useAuth();
  // Buscador personalizado por contexto (sin RF asociado, petición
  // directa del usuario) — mismo criterio que /buscar (home-screen.tsx):
  // primer nombre, con el correo como respaldo si todavía no hay
  // fullName resuelto.
  const userFirstName = (user?.fullName ?? user?.email ?? "").split(" ")[0] || undefined;
  const geolocation = useConsumerGeolocation();
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Negocio pedido por `initialBusinessId` que no vino en la búsqueda
  // general (fuera de radio/límite, o filtrado por precio/abierto-ahora)
  // — se agrega a `businesses` para que también se vea como pin, no
  // solo como BusinessSummarySheet flotando sin nada que lo marque en
  // el mapa. `handledInitialBusinessIdRef` evita repetir el fetch si
  // este componente vuelve a renderizar con el mismo id (y permite un
  // id NUEVO si la URL cambia a otro negocio sin recargar la página).
  const [externalPin, setExternalPin] = useState<BusinessPin | null>(null);
  const handledInitialBusinessIdRef = useRef<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [offerTypes, setOfferTypes] = useState<OfferType[]>([]);
  // Vista de lista filtrada de pantalla completa (redediseño de
  // navegación global, sin RF asociado — ver CLAUDE.md,
  // FilteredListSheet) — con salida explícita (botón "Volver" dentro del
  // propio sheet) para que el consumidor no quede atrapado viendo solo
  // una lista filtrada.
  const [listFilter, setListFilter] = useState<DiscoveryListFilter | null>(initialListFilter ?? null);
  // Texto libre del buscador del mapa (Fase 1 de la fusión de
  // buscadores, sin RF asociado — ver CLAUDE.md sección 45). `searchKey`
  // fuerza un remount de SearchBar (que maneja su propio input
  // internamente, sin `value` controlado) para limpiar visualmente el
  // campo cuando se toca "Limpiar" — sigue haciendo falta aunque el
  // input ahora viva dentro de MapSearchSheet (Fase B, sección 51).
  const [query, setQuery] = useState("");
  const [searchKey, setSearchKey] = useState(0);
  // Sencilla/avanzada (Fase 3, sin RF asociado — ver CLAUDE.md sección
  // 48): decide si se muestran precios — los campos de precio del
  // buscador y los chips de "por qué coincidió". Default "sencilla",
  // sin persistencia.
  const [advanced, setAdvanced] = useState(false);
  const [zones, setZones] = useState<BusinessZone[]>([]);
  const [selected, setSelected] = useState<BusinessPin | null>(null);
  // Negocio recién tocado, mientras el pin todavía está en la animación
  // de crecimiento (ver PIN_GROW_ANIMATION_MS) — separado de `selected`
  // a propósito: `selected` es lo que abre BusinessSummarySheet, y el
  // pin debe empezar a crecer de inmediato al tocar, ANTES de que ese
  // popup aparezca, no al mismo tiempo.
  const [pendingSelection, setPendingSelection] = useState<BusinessPin | null>(null);
  const pendingSelectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hoja de búsqueda (texto + Sencilla/Avanzada + distancia/precio/
  // abierto-ahora + resultados, todo junto — Fase B, sección 51),
  // abierta desde "Buscar" en MainFloatingNav.
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [filters, setFilters] = useState<MapFiltersState>({
    radiusKm: DEFAULT_MAP_RADIUS_KM,
    priceMin: "",
    priceMax: "",
    openNow: false,
  });

  useEffect(() => {
    let ignore = false;
    api.GET("/categories").then(({ data }) => {
      if (!ignore && data) setCategories(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    api.GET("/offer-types").then(({ data }) => {
      if (!ignore && data) setOfferTypes(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Si la URL cambia a un filtro NUEVO (ej. dos accesos seguidos desde
  // distintos íconos, sin recargar la página), se refleja acá — pero un
  // cierre manual (botón "Volver" del sheet, listFilter -> null) no debe
  // reabrirse solo porque este efecto vuelve a correr con las mismas
  // props.
  const lastAppliedInitialFilterRef = useRef(initialListFilter);
  useEffect(() => {
    if (initialListFilter !== lastAppliedInitialFilterRef.current) {
      lastAppliedInitialFilterRef.current = initialListFilter;
      setListFilter(initialListFilter ?? null);
    }
  }, [initialListFilter]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.name !== undefined) {
        map.set(category.id, category.name);
      }
    });
    return map;
  }, [categories]);

  /** Categoría completa por id — el pin toma de acá su ícono y color guardados (Category.icon/color, PR 2 de 3). */
  const categoriesById = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((category) => {
      if (category.id !== undefined) map.set(category.id, category);
    });
    return map;
  }, [categories]);

  /** `Category.type` por id — lo siguen usando el banner/hoja/tarjetas (se pasan a Category.icon/color en el PR 3). */
  const categoryTypeById = useMemo(() => {
    const map = new Map<number, CatalogType>();
    categories.forEach((category) => {
      if (category.id !== undefined && category.type !== undefined) {
        map.set(category.id, category.type);
      }
    });
    return map;
  }, [categories]);

  // Banner de descubrimiento, familia "Disponibles ahora" (Fase 1, sin
  // RF asociado) — resaltado del pin correspondiente al deslizar entre
  // tarjetas, ver DiscoveryBanner. `null` mientras no se ha deslizado
  // ninguna tarjeta todavía; el primer negocio de la lista se usa como
  // resalte por default (ver `bannerHighlightId` más abajo), sin
  // necesitar un efecto aparte solo para inicializarlo.
  const [bannerActiveId, setBannerActiveId] = useState<string | null>(null);

  const {
    businesses: rawBusinesses,
    loading,
    search,
  } = useBusinessSearch({
    limit: MAP_RESULTS_LIMIT,
    radiusKm: filters.radiusKm ?? DEFAULT_MAP_RADIUS_KM,
    geolocation,
  });

  // Independiente de la búsqueda principal (misma fuente de datos —
  // GET /businesses/nearby o /businesses, ya con `openNow` — pero con
  // su propio radio fijo, sin depender del radio que el usuario haya
  // elegido en MapSearchSheet para la búsqueda principal): "disponibles
  // ahora" es su propia familia, no un recorte de lo que el usuario ya
  // esté buscando por texto/categoría/precio.
  const { businesses: openNowRaw, search: searchOpenNow } = useBusinessSearch({
    limit: DISCOVERY_BANNER_LIMIT,
    radiusKm: DEFAULT_MAP_RADIUS_KM,
    geolocation,
  });

  // "Cerca de ti ahora" (sin RF asociado, petición directa del usuario —
  // ver CLAUDE.md sección 54): mismo criterio que "Disponibles ahora"
  // arriba — misma fuente de datos, su propio radio fijo, independiente
  // de lo que el usuario esté buscando en MapSearchSheet. Alcanzable
  // como pestaña dentro de la hoja inferior unificada
  // (FilteredListSheet), no como su propio carrusel en el banner —ese
  // ya quedó reducido a solo "Disponibles ahora" (retroalimentación
  // sobre el redediseño de navegación global, sección 54).
  const { businesses: activeOffersRaw, search: searchActiveOffers } = useBusinessSearch({
    limit: DISCOVERY_BANNER_LIMIT,
    radiusKm: DEFAULT_MAP_RADIUS_KM,
    geolocation,
  });

  const businesses = useMemo<BusinessPin[]>(() => {
    const base = (rawBusinesses ?? []).filter(
      (business): business is BusinessPin =>
        typeof business.latitude === "number" && typeof business.longitude === "number",
    );
    // "Ver en el mapa" (Fase 4, sección 49): el negocio pedido por
    // initialBusinessId puede no estar entre los resultados de la
    // búsqueda general — se agrega aparte, sin duplicar si ya vino.
    if (externalPin && !base.some((b) => b.id === externalPin.id)) {
      return [...base, externalPin];
    }
    return base;
  }, [rawBusinesses, externalPin]);

  // Banner "Disponibles ahora": mismos negocios con coordenadas, ya
  // ordenados por distancia (con confirmación fresca primero en caso de
  // empate — ver lib/discovery/available-now.ts). Independiente de
  // `businesses` (los pines del mapa, sujetos a los filtros que el
  // usuario haya elegido en MapSearchSheet) — un negocio puede aparecer
  // en el banner sin ser en este momento uno de los pines visibles (ej.
  // si el usuario ya filtró por un precio que lo excluye); en ese caso
  // el detalle (BusinessSummarySheet) sigue abriendo correctamente, solo
  // no hay un pin de verdad al que resaltar. Caso raro, aceptado — no es
  // el algoritmo definitivo de esta fase.
  const discoveryBusinesses = useMemo<BusinessPin[]>(() => {
    const withCoords = (openNowRaw ?? []).filter(
      (business): business is BusinessPin =>
        typeof business.latitude === "number" && typeof business.longitude === "number",
    );
    return sortAvailableNow(withCoords);
  }, [openNowRaw]);

  // "Cerca de ti ahora": un producto vigente de cada negocio se vuelve
  // una tarjeta propia (no una fila de negocio), así que acá se
  // APLANA — un negocio con 2 ofertas vigentes produce 2 entradas. `id`
  // compuesto (`${businessId}-${índice}`), nunca un id persistente del
  // backend. Ya vienen ordenados por distancia (misma consulta que
  // discoveryBusinesses) — dentro de cada negocio, por vigencia
  // ascendente (ver negocios.repository.js#lateralOfertasVigentes).
  const discoveryOffers = useMemo<DiscoveryOffer[]>(() => {
    const withCoords = (activeOffersRaw ?? []).filter(
      (business): business is BusinessPin =>
        typeof business.latitude === "number" && typeof business.longitude === "number",
    );
    const offers: DiscoveryOffer[] = [];
    for (const business of withCoords) {
      if (!business.id) continue;
      (business.activeOffers ?? []).forEach((offer, index) => {
        if (!offer.name) return;
        offers.push({
          id: `${business.id}-${index}`,
          business,
          name: offer.name,
          offerTypeId: offer.offerTypeId ?? null,
          validUntil: offer.validUntil ?? null,
        });
      });
    }
    return offers;
  }, [activeOffersRaw]);

  // Tarjeta activa del banner: lo último que el usuario deslizó/tocó, o
  // el primer negocio "Disponibles ahora" por default — sin esto, el
  // banner arrancaría sin ninguna tarjeta resaltada hasta el primer
  // swipe.
  const bannerHighlightId = bannerActiveId ?? discoveryBusinesses[0]?.id ?? null;

  const runSearch = useCallback(() => {
    const priceMin = filters.priceMin ? Number(filters.priceMin) : undefined;
    const priceMax = filters.priceMax ? Number(filters.priceMax) : undefined;
    search({ q: query || undefined, priceMin, priceMax, openNow: filters.openNow });
  }, [search, query, filters.priceMin, filters.priceMax, filters.openNow]);

  function handleTextSearch(text: string) {
    setQuery(text);
  }

  function handleClearSearch() {
    setQuery("");
    setSearchKey((k) => k + 1);
  }

  /**
   * Volver a "Sencilla" limpia cualquier filtro de precio ya aplicado
   * (Fase 3, sección 48) — sin esto, un precio elegido en modo avanzado
   * seguiría filtrando los resultados en silencio aunque el panel ya no
   * muestre esos campos (estado invisible afectando el resultado, sin
   * ninguna pista visual de por qué). `runSearch()` se vuelve a disparar
   * solo (su propia identidad cambia con filters.priceMin/priceMax, y el
   * efecto de más abajo reacciona a eso).
   */
  function handleModeChange(next: boolean) {
    setAdvanced(next);
    if (!next) setFilters((f) => ({ ...f, priceMin: "", priceMax: "" }));
  }

  /**
   * "Zonas de aglomeración" (ver CLAUDE.md sección 32) — solo se piden
   * con geolocalización concedida a propósito: sin un punto de
   * referencia real del consumidor, "la zona en la que estás" no
   * significa nada (mismo criterio que ZoneComparisonCard, que usa la
   * primera zona del resultado como proxy de "zona actual"). Sin
   * geolocalización, el mapa sigue mostrando pines individuales
   * normalmente — solo se pierde el resaltado de zonas y la
   * comparación, no la búsqueda en sí.
   */
  const loadZones = useCallback(async () => {
    const coords = geolocation.status === "granted" ? geolocation.coords : null;
    if (!coords) {
      setZones([]);
      return;
    }

    const { data } = await api.GET("/businesses/zones", {
      params: {
        query: {
          lat: coords.lat,
          lng: coords.lng,
          radiusKm: filters.radiusKm,
        },
      },
    });
    setZones(data ?? []);
  }, [geolocation.status, geolocation.coords, filters.radiusKm]);

  useEffect(() => {
    if (geolocation.status === "loading" || geolocation.status === "idle") return;
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) {
        runSearch();
        loadZones();
        searchOpenNow({ openNow: true });
        searchActiveOffers({ hasActiveOffer: true });
      }
    });
    return () => {
      ignore = true;
    };
  }, [geolocation.status, runSearch, loadZones, searchOpenNow, searchActiveOffers]);

  /**
   * "Ver en el mapa" (Fase 4, sección 49) — pide el perfil completo en
   * vez de buscar entre `businesses` porque el negocio puede quedar
   * fuera del radio/límite/filtros de la búsqueda general (ej. lejos de
   * la ubicación del consumidor). Usa `profile.location` (no
   * `profile.latitude/longitude`, que quedan `null` en un GET por id —
   * ver business.mapper.js#toApiBusiness, "solo se llena en
   * listar/cercanos") — respeta la misma regla de "zona aproximada" vs.
   * dirección exacta que ya aplica el backend según quién pregunta.
   */
  useEffect(() => {
    if (!initialBusinessId || !mapReady) return;
    if (handledInitialBusinessIdRef.current === initialBusinessId) return;
    handledInitialBusinessIdRef.current = initialBusinessId;

    let ignore = false;
    api.GET("/businesses/{businessId}", { params: { path: { businessId: initialBusinessId } } }).then(({ data }) => {
      if (ignore || !data) return;
      const { latitude, longitude } = data.location ?? {};
      if (latitude == null || longitude == null) return;

      const pin: BusinessPin = { ...data, latitude, longitude };
      setExternalPin(pin);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([latitude, longitude], LOCATE_ME_ZOOM, { animate: true });
      }
      setSelected(pin);
    });
    return () => {
      ignore = true;
    };
  }, [initialBusinessId, mapReady]);

  // "Cargando" de verdad hasta que se resuelva la PRIMERA búsqueda
  // (rawBusinesses === null) — `loading` del hook solo cubre mientras
  // una petición está en vuelo, no el instante entre montar y que
  // geolocation.status deje "loading"/"idle" y dispare el efecto de
  // arriba; sin esto, ese instante mostraría "No encontramos negocios"
  // en vez del skeleton.
  const showSkeleton = businesses.length === 0 && (loading || rawBusinesses === null);
  // Con `query` activo, MapSearchSheet ya comunica "sin resultados" para
  // ese texto — no duplicar el mismo mensaje centrado sobre el mapa. Con
  // la hoja abierta tampoco (Fase B, sección 51): mostrar un mensaje
  // flotando detrás de una hoja que ya cubre media pantalla es ruido.
  const showEmptyState =
    !loading && rawBusinesses !== null && businesses.length === 0 && !query && !searchSheetOpen && !listFilter;

  let center = DEFAULT_CENTER;
  if (geolocation.status === "granted" && geolocation.coords) {
    center = geolocation.coords;
  } else if (businesses.length > 0) {
    center = { lat: businesses[0].latitude, lng: businesses[0].longitude };
  }

  const userLocation = geolocation.status === "granted" ? geolocation.coords : null;
  const showRadiusFilter = geolocation.status === "granted";
  const showLocationHint =
    !listFilter && geolocation.status !== "granted" && geolocation.status !== "loading" && geolocation.status !== "idle";

  function handleLocateMe() {
    if (geolocation.status === "granted" && geolocation.coords && mapInstanceRef.current) {
      mapInstanceRef.current.setView([geolocation.coords.lat, geolocation.coords.lng], LOCATE_ME_ZOOM, {
        animate: true,
      });
      return;
    }
    // Sin ubicación concedida (o todavía cargando): reintenta el permiso
    // — si el usuario lo otorga ahora, FitToResults en leaflet-map.tsx ya
    // reacciona solo a `userLocation` cambiando, sin lógica extra acá.
    geolocation.retry();
  }

  function handleSelectBusiness(business: BusinessPin) {
    setSearchSheetOpen(false);
    setListFilter(null);
    // El pin ya arranca a crecer acá (ver selectedBusinessId más abajo,
    // que combina pendingSelection y selected) — BusinessSummarySheet
    // recién se abre cuando esa animación termina.
    if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    setPendingSelection(business);
    pendingSelectionTimeoutRef.current = setTimeout(() => {
      setSelected(business);
      setPendingSelection(null);
      pendingSelectionTimeoutRef.current = null;
    }, PIN_GROW_ANIMATION_MS);
  }

  /**
   * Tocar un resultado dentro de MapSearchSheet/FilteredListSheet (Fase
   * 1, sección 45) — a diferencia de tocar un pin ya visible, el negocio
   * puede estar fuera del encuadre actual o agrupado dentro de un
   * cluster, así que primero recentra el mapa sobre su coordenada
   * (mismo zoom que "Mi ubicación") y recién ahí dispara la misma
   * selección que un pin.
   */
  function handleSelectFromSearch(business: BusinessPin) {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([business.latitude, business.longitude], LOCATE_ME_ZOOM, {
        animate: true,
      });
    }
    handleSelectBusiness(business);
  }

  useEffect(() => {
    return () => {
      if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    };
  }, []);

  /** Cambió la tarjeta más visible del banner (swipe o tap) — solo resalta el pin, sin recentrar ni abrir el resumen (ver DiscoveryBanner). */
  function handleBannerActiveChange(business: BusinessPin) {
    setBannerActiveId(business.id ?? null);
  }

  /** Tocar el CONTENIDO de una tarjeta del banner — nivel 2, mismo BusinessSummarySheet que tocar un pin (sin recentrar, ver handleSelectBusiness). */
  function handleBannerOpenDetail(business: BusinessPin) {
    setBannerActiveId(business.id ?? null);
    handleSelectBusiness(business);
  }

  /**
   * "📍 Ver en mapa"/"Ver ubicación"/"Ver zona" del banner — misma
   * acción técnica sin importar el wording (ver
   * resolveLocationActionLabel en discovery-row.tsx): recentra el
   * mapa sobre ese negocio, mismo criterio que tocar un resultado
   * dentro de MapSearchSheet (puede estar fuera del encuadre actual o
   * agrupado en un cluster).
   */
  function handleBannerViewOnMap(business: BusinessPin) {
    setBannerActiveId(business.id ?? null);
    handleSelectFromSearch(business);
  }

  /** Ícono de categoría de una fila del banner/lista filtrada — navega a la lista filtrada por esa categoryId (redediseño de navegación global, sin RF asociado). */
  function handleCategoryClick(business: BusinessPin) {
    if (business.categoryId != null) {
      setListFilter({ type: "category", categoryId: business.categoryId });
    }
  }

  /** "Ver todas" al final del carrusel del banner — abre la hoja inferior unificada ya en la pestaña "Disponibles ahora" (ver FilteredListSheet). */
  function handleOpenAvailableList() {
    setListFilter({ type: "available_now" });
  }

  /**
   * "Volver al mapa" de `MainFloatingNav` cuando algo tapa la vista
   * (resumen de negocio, hoja de búsqueda o la lista filtrada) — cierra
   * ese overlay en vez de navegar (ya se está en `/mapa`). Retroalimentación
   * sobre el redediseño de navegación global (sin RF asociado, petición
   * directa del usuario): sin esto, quitar "centrar mapa" al abrir
   * cualquiera de estos dejaba al usuario sin ninguna forma de volver.
   */
  function handleBackToMap() {
    if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    setPendingSelection(null);
    setSelected(null);
    setSearchSheetOpen(false);
    setListFilter(null);
  }

  /** "Ver esa zona" en ZoneComparisonCard — recentra el mapa sobre la zona sugerida, mismo zoom que "Mi ubicación". */
  function handleJumpToZone(zone: BusinessZone) {
    if (mapInstanceRef.current && zone.centerLatitude != null && zone.centerLongitude != null) {
      mapInstanceRef.current.setView([zone.centerLatitude, zone.centerLongitude], LOCATE_ME_ZOOM, {
        animate: true,
      });
    }
  }

  function handleToggleSearchSheet() {
    if (pendingSelectionTimeoutRef.current) clearTimeout(pendingSelectionTimeoutRef.current);
    setPendingSelection(null);
    setSelected(null);
    setListFilter(null);
    setSearchSheetOpen((open) => !open);
  }

  // "Centrar mapa" se oculta sin mapa visible: con la vista de lista
  // filtrada activa (aunque la ruta siga siendo /mapa), o con el resumen
  // de un negocio/la hoja de búsqueda tapando el mapa completo (mismo
  // criterio que ya regía cuándo se mostraba el FloatingActionStack
  // viejo, ahora expresado como "onCenterMap ausente" en vez de "no
  // renderizar nada").
  const showMap = !selected && !searchSheetOpen && !listFilter;

  return (
    <div className="flex flex-1 flex-col pb-6">
      {showLocationHint && (
        <p className="bg-ambar/10 px-4 py-2 font-sans text-body-sm text-text-muted">
          No pudimos acceder a tu ubicación. Mostrando negocios de Ciudad Verde — toca el botón de ubicación para
          intentar de nuevo.
        </p>
      )}

      {/* Banner de descubrimiento, familia "Disponibles ahora" (Fase 1,
          sin RF asociado) — apilado debajo del aviso de ubicación si
          aplica, arriba del mapa. Sin negocios abiertos ahora, el
          componente mismo no renderiza nada (nada de estado vacío
          forzado). Oculto con la lista filtrada activa: ver los dos a
          la vez sería confuso. */}
      {!listFilter && (
        <DiscoveryBanner
          businesses={discoveryBusinesses}
          categoryTypeById={categoryTypeById}
          categoryNameById={categoryNameById}
          activeId={bannerHighlightId}
          onActiveChange={handleBannerActiveChange}
          onOpenDetail={handleBannerOpenDetail}
          onViewOnMap={handleBannerViewOnMap}
          onCategoryClick={handleCategoryClick}
          onOpenList={handleOpenAvailableList}
        />
      )}

      <div className="relative min-h-[420px] flex-1">
        {/*
          Wrapper `absolute inset-0` a propósito, no `h-full w-full`: un
          hijo en flujo normal (position:relative/static) dentro de un
          contenedor cuyo alto viene de flex-grow (flex-1) no resuelve de
          forma confiable `height:100%` en los navegadores reales — un
          límite conocido y documentado de Flexbox, no un bug de Tailwind
          ni de Leaflet (confirmado verificando contra un navegador real:
          el mismo `height:100%` en un hijo `position:absolute` sí
          resolvía, en uno `position:relative` no). `absolute inset-0`
          resuelve contra la caja de padding del ancestro posicionado más
          cercano por un algoritmo distinto, que sí es confiable acá.

          `isolate` es el segundo ajuste real encontrado retrofitando
          FloatingActionStack acá: Leaflet mueve sus paneles internos con
          `transform` (para paneo acelerado por GPU) y les asigna z-index
          propios (hasta 700) — sin aislar su contexto de apilamiento,
          esos paneles pueden pintarse por encima de un
          `position: fixed` hermano fuera de este div (el
          FloatingActionStack de más abajo), sin importar que su propio
          z-index sea menor: es un problema de qué contexto de
          apilamiento gana, no de qué número es más alto. `isolate`
          contiene TODO el apilamiento interno de Leaflet dentro de este
          div — hacia afuera, el div compite como una sola unidad según
          el orden del documento, así que el FloatingActionStack (que
          viene después en el JSX) vuelve a ganar de forma confiable.
        */}
        <div className="absolute inset-0 isolate">
          {showSkeleton ? (
            <div className="flex h-full w-full flex-col gap-2 p-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <LeafletMap
              center={center}
              userLocation={userLocation}
              businesses={businesses}
              categoriesById={categoriesById}
              zones={zones}
              selectedBusinessId={pendingSelection?.id ?? selected?.id ?? bannerHighlightId}
              onSelectBusiness={handleSelectBusiness}
              onMapReady={(map) => {
                mapInstanceRef.current = map;
                setMapReady(true);
              }}
            />
          )}
        </div>

        {showEmptyState && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
            <p className="rounded-card bg-surface px-4 py-3 text-center font-sans text-body-sm text-text-muted shadow">
              No encontramos negocios que coincidan con estos filtros.
            </p>
          </div>
        )}

        {showMap && <ZoneComparisonCard zones={zones} onJumpToZone={handleJumpToZone} />}

        {selected && (
          <BusinessSummarySheet
            business={selected}
            categoryName={selected.categoryId != null ? (categoryNameById.get(selected.categoryId) ?? null) : null}
            onClose={() => setSelected(null)}
            showPrices={advanced}
          />
        )}

        {searchSheetOpen && (
          <MapSearchSheet
            searchKey={searchKey}
            query={query}
            userFirstName={userFirstName}
            onSearch={handleTextSearch}
            onClear={handleClearSearch}
            advanced={advanced}
            onModeChange={handleModeChange}
            filters={filters}
            onFiltersChange={setFilters}
            showRadius={showRadiusFilter}
            results={businesses}
            resultsLoading={loading}
            categoryNameById={categoryNameById}
            onSelectResult={handleSelectFromSearch}
            onClose={() => setSearchSheetOpen(false)}
          />
        )}

        {listFilter && (
          <FilteredListSheet
            filter={listFilter}
            availableNow={discoveryBusinesses}
            activeOffers={discoveryOffers}
            categoryTypeById={categoryTypeById}
            categoryNameById={categoryNameById}
            offerTypes={offerTypes}
            geolocation={geolocation}
            onViewOnMap={handleSelectFromSearch}
            onClose={() => setListFilter(null)}
          />
        )}

        {showMap && (
          <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-surface/90 px-3 py-2 shadow-lg backdrop-blur">
            <RuteandoLogo size={28} />
            <span className="font-heading text-title-2 font-bold text-terracota">Ruteando</span>
          </div>
        )}

        <MainFloatingNav
          onCenterMap={showMap ? handleLocateMe : undefined}
          onBackToMap={!showMap ? handleBackToMap : undefined}
          onSearch={handleToggleSearchSheet}
        />
      </div>
    </div>
  );
}
