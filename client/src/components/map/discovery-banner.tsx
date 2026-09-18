"use client";

import { useCallback, useEffect, useRef } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import { MapPin } from "@phosphor-icons/react/dist/ssr";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { resolveCatalogIcon } from "@/lib/catalog/catalog-icons";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import { getCategoryPinColor } from "@/lib/map/category-pin-colors";
import { buildDirectionsUrl } from "@/lib/format/directions";
import { formatDistance } from "@/lib/format/distance";
import type { BusinessPin } from "@/components/map/leaflet-map";

interface DiscoveryBannerProps {
  /** Ya filtrados a `openNow=true` y ordenados (ver lib/discovery/available-now.ts) — este componente no vuelve a decidir quién entra ni en qué orden. */
  businesses: BusinessPin[];
  categoryTypeById: Map<number, CatalogType>;
  /** El pin resaltado en el mapa en este momento — solo para el borde de la tarjeta activa, ver map-screen.tsx. */
  activeId: string | null;
  /** Cambió la tarjeta más visible (swipe o tap) — el padre resalta el pin correspondiente, sin recentrar. */
  onActiveChange: (business: BusinessPin) => void;
  /** Tocar el CONTENIDO de la tarjeta (no un ícono de acción) — abre el nivel 2 (BusinessSummarySheet). */
  onOpenDetail: (business: BusinessPin) => void;
  /** "📍 Ver en mapa"/"Ver ubicación"/"Ver zona" — misma acción técnica sin importar el wording: recentra el mapa y resalta el pin. */
  onViewOnMap: (business: BusinessPin) => void;
}

/**
 * Wording de la acción de ubicación por tipo de negocio (petición
 * directa del usuario): un local fijo se "ve en el mapa" (una dirección
 * concreta); un ambulante "se ve" donde esté ahora (misma acción
 * técnica, wording honesto sobre que se mueve); un servicio (mismo
 * criterio que ya usa review-tags.ts para variar según
 * `Category.type`) se enmarca como una zona que atiende, no un punto
 * fijo al que "llegar". Secundario, no bloquea el resto de esta
 * funcionalidad.
 */
function resolveLocationActionLabel(business: BusinessPin, catalogType: CatalogType | null): string {
  if (catalogType === "services") return "Ver zona";
  return business.mobility === "fixed" ? "Ver en mapa" : "Ver ubicación";
}

// Auto-rotación (petición directa del usuario, sin RF asociado): con más
// de un negocio, el banner avanza solo cada 4.5s — dentro del rango
// pedido (4-5s), sin depender de que el usuario deslice. `RESUME_AFTER_IDLE_MS`
// es una decisión propia (no pedida con un valor exacto): tras una
// interacción manual (swipe, arrastre con mouse, scroll con rueda/
// trackpad), el auto-avance se pausa de inmediato y solo se reanuda si
// pasan 6s sin otra interacción — lo bastante corto para que el banner
// siga sintiéndose "vivo" si el usuario se queda mirando, lo bastante
// largo para no pelearse con alguien deslizando varias veces seguidas.
const AUTO_ADVANCE_INTERVAL_MS = 4500;
const RESUME_AFTER_IDLE_MS = 6000;

/**
 * Nivel 1 del banner de descubrimiento (sin RF asociado, petición
 * directa del usuario) — Fase 1: solo la familia "Disponibles ahora".
 * Promociones/Eventos/Nuevos y el deslizamiento ENTRE familias quedan
 * para fases futuras, no construidas todavía. Vive arriba del mapa,
 * en el mismo lugar que el aviso de "no pudimos acceder a tu
 * ubicación" (map-screen.tsx decide el apilamiento) — nunca dentro del
 * contenedor del mapa, así que no compite con ZoneComparisonCard ni con
 * FloatingActionStack.
 *
 * Sin negocios disponibles ahora, no se muestra nada — nada de estado
 * vacío forzado (pedido explícito).
 *
 * El carrusel es scroll-snap nativo (sin librería nueva: el proyecto no
 * tenía ninguna de swipe/carrusel instalada) — la tarjeta "activa" se
 * decide con un IntersectionObserver sobre el contenedor con scroll
 * (más robusto que calcular anchos/gaps a mano, que se rompería si el
 * nombre de un negocio hace crecer su tarjeta). Con más de un negocio,
 * también avanza solo cada 4.5s (ver AUTO_ADVANCE_INTERVAL_MS más abajo)
 * — se pausa de inmediato ante cualquier gesto manual (swipe, arrastre,
 * rueda/trackpad, o tocar una tarjeta) y se reanuda tras un rato de
 * inactividad.
 */
export function DiscoveryBanner({
  businesses,
  categoryTypeById,
  activeId,
  onActiveChange,
  onOpenDetail,
  onViewOnMap,
}: DiscoveryBannerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  // Timestamp (Date.now()) hasta el cual el auto-avance está pausado —
  // en un ref, no en estado, porque pausar/reanudar no necesita
  // re-renderizar nada (solo lo lee el propio intervalo).
  const pausedUntilRef = useRef(0);

  const pauseAutoAdvance = useCallback(() => {
    pausedUntilRef.current = Date.now() + RESUME_AFTER_IDLE_MS;
  }, []);

  /**
   * Bug real (reportado por Jose, no reproducido en celular — ahí el
   * touch nunca dispara `wheel`): un scroll VERTICAL normal de la
   * página con el cursor pasando por encima del banner también dispara
   * `wheel` sobre este contenedor (el evento sigue el cursor, no si el
   * elemento realmente se desplazó) — pausar ante CUALQUIER wheel
   * reiniciaba el temporizador de 6s en bucle mientras alguien
   * simplemente bajaba la página, y el auto-avance nunca llegaba a
   * dispararse. Solo un wheel con componente HORIZONTAL dominante
   * (`deltaX` mayor que `deltaY` en magnitud — un gesto de trackpad de
   * dos dedos hacia los lados, o shift+rueda) indica de verdad "estoy
   * deslizando el carrusel"; un scroll vertical de la página no debe
   * pausar nada.
   */
  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) pauseAutoAdvance();
    },
    [pauseAutoAdvance],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || businesses.length <= 1) return;

    const intervalId = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;

      // Mueve `scrollLeft` directamente, no `scrollIntoView` sobre "la
      // siguiente tarjeta" por id — segundo bug real encontrado
      // verificando esto en vivo en una ventana ancha (no solo el de la
      // pausa por wheel de arriba): en desktop, varias tarjetas ya están
      // 100% visibles al mismo tiempo dentro del contenedor, y
      // `scrollIntoView({inline:"center"})` sobre un elemento que el
      // navegador ya considera "visible" NO MUEVE NADA (verificado con
      // `container.scrollLeft` antes/después de llamarlo: se quedaba
      // fijo en 0 sin importar cuántas veces se disparara el intervalo
      // — por eso "nunca rotaba sola" en PC, no solo por el wheel).
      //
      // El paso se mide en vivo (distancia real entre las primeras dos
      // tarjetas), no un ancho de tarjeta hardcodeado (`w-64`) ni el
      // ancho completo del contenedor — lo segundo se probó primero y
      // tiene su propio bug: si `clientWidth` (lo que se ve) es mayor
      // que `maxScrollLeft` (lo que falta por recorrer, común quando
      // caben casi todas las tarjetas a la vez en una ventana ancha),
      // sumar un contenedor entero SIEMPRE se pasa del máximo y
      // "avanza" de vuelta al mismo 0 — cero movimiento visible, el
      // mismo síntoma reportado. Medir el paso real evita las dos cosas.
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      if (maxScrollLeft <= 0) return; // todas las tarjetas caben a la vez, nada que rotar

      const first = container.children.item(0) as HTMLElement | null;
      const second = container.children.item(1) as HTMLElement | null;
      const step = first && second ? second.offsetLeft - first.offsetLeft : container.clientWidth;

      const next = container.scrollLeft + step;
      container.scrollTo({ left: next > maxScrollLeft ? 0 : next, behavior: "smooth" });
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [businesses]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || businesses.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce<IntersectionObserverEntry | null>(
          (best, entry) => (!best || entry.intersectionRatio > best.intersectionRatio ? entry : best),
          null,
        );
        if (!mostVisible || mostVisible.intersectionRatio < 0.5) return;
        const id = mostVisible.target.getAttribute("data-business-id");
        const business = businesses.find((b) => b.id === id);
        if (business) onActiveChange(business);
      },
      { root: container, threshold: [0.5, 0.75, 1] },
    );

    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // Solo cuando cambia la LISTA de negocios (no en cada cambio de
    // `activeId`/`onActiveChange`, que cambiarían en cada swipe y
    // recrearían el observer sin necesidad).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businesses]);

  if (businesses.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface">
      <div
        ref={containerRef}
        onPointerDown={pauseAutoAdvance}
        onWheel={handleWheel}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {businesses.map((business) => {
          if (!business.id) return null;
          const catalogType =
            business.categoryId != null ? categoryTypeById.get(business.categoryId) ?? null : null;
          const CategoryIcon = resolveCatalogIcon(catalogType);
          const color = getCategoryPinColor(business.categoryId, catalogType);
          const statusText = business.availabilityConfirmedAt ? "Vendiendo ahora" : "Abierto";
          const locationLabel = resolveLocationActionLabel(business, catalogType);
          const hasCoords = typeof business.latitude === "number" && typeof business.longitude === "number";
          const isActive = activeId === business.id;

          return (
            <div
              key={business.id}
              ref={(el) => {
                if (el) cardRefs.current.set(business.id!, el);
                else cardRefs.current.delete(business.id!);
              }}
              data-business-id={business.id}
              className={`w-64 shrink-0 snap-center rounded-card border bg-background transition-colors ${
                isActive ? "border-terracota" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  pauseAutoAdvance();
                  onOpenDetail(business);
                }}
                aria-label={`Ver detalle de ${business.name ?? "este negocio"}`}
                className="flex w-full items-center gap-2 px-3 pt-2.5 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: color }}
                >
                  <CategoryIcon size={18} weight="fill" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-sans text-body-sm font-semibold text-text">{business.name}</span>
                  <span className="flex items-center gap-1.5 font-sans text-caption text-text-muted">
                    {typeof business.distanceMeters === "number" && (
                      <span>{formatDistance(business.distanceMeters)}</span>
                    )}
                    <span className="inline-flex items-center gap-1 font-medium text-verde">
                      <span className="h-1.5 w-1.5 rounded-full bg-verde" />
                      {statusText}
                    </span>
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    pauseAutoAdvance();
                    onViewOnMap(business);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 font-sans text-caption font-medium text-terracota"
                >
                  <MapPin size={14} weight="bold" />
                  {locationLabel}
                </button>
                {hasCoords && (
                  <a
                    href={buildDirectionsUrl(business.latitude, business.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 font-sans text-caption font-medium text-terracota"
                  >
                    <RuteandoLogo size={14} />
                    Cómo llegar
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
