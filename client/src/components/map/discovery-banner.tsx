"use client";

import { useCallback, useEffect, useRef } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import { DiscoveryRow } from "@/components/discovery/discovery-row";
import type { BusinessPin } from "@/components/map/leaflet-map";

interface DiscoveryBannerProps {
  /** "Disponibles ahora" — ya filtrados a `openNow=true` y ordenados (ver lib/discovery/available-now.ts), este componente no vuelve a decidir quién entra ni en qué orden. */
  businesses: BusinessPin[];
  categoryTypeById: Map<number, CatalogType>;
  /** Nombre de categoría por id (`GET /categories`, ya resuelto en map-screen.tsx) — el ícono de color solo no comunica de qué categoría se trata, esto agrega el texto en las tarjetas y en la vista rápida del ⓘ. */
  categoryNameById: Map<number, string>;
  /** El pin resaltado en el mapa en este momento — solo para el borde de la tarjeta activa, ver map-screen.tsx. */
  activeId: string | null;
  /** Cambió la tarjeta más visible (swipe o tap) — el padre resalta el pin correspondiente, sin recentrar. */
  onActiveChange: (business: BusinessPin) => void;
  /** Tocar el CONTENIDO de la tarjeta (no un ícono de acción) — abre el resumen (BusinessSummarySheet). */
  onOpenDetail: (business: BusinessPin) => void;
  /** "📍 Ver en mapa"/"Ver ubicación"/"Ver zona" — misma acción técnica sin importar el wording: recentra el mapa y resalta el pin. */
  onViewOnMap: (business: BusinessPin) => void;
  /** El ícono de categoría de cada fila navega a la lista filtrada por esa `categoryId` (ver `FilteredListSheet` en map-screen.tsx). */
  onCategoryClick: (business: BusinessPin) => void;
  /**
   * Retroalimentación sobre el mapa (sin RF asociado, petición directa
   * del usuario): reemplaza a la fila-título "Disponibles ahora" que
   * vivía arriba del carrusel — quitarla le devuelve esa fila de alto al
   * mapa. La entrada a "ver más disponibles ahora" (antes el ícono ⓘ de
   * esa fila) ahora es la última tarjeta del propio carrusel, así que no
   * consume ninguna fila propia.
   */
  onOpenList: () => void;
}

// Auto-rotación del carrusel de tarjetas (petición directa del usuario,
// sin RF asociado): con más de un negocio, avanza solo cada 4.5s —
// dentro del rango pedido (4-5s). `RESUME_AFTER_IDLE_MS` es una decisión
// propia (no pedida con un valor exacto): tras una interacción manual
// (swipe, arrastre con mouse, rueda/trackpad horizontal, o tocar una
// tarjeta), el auto-avance se pausa de inmediato y solo se reanuda si
// pasan 6s sin otra interacción.
const AUTO_ADVANCE_INTERVAL_MS = 4500;
const RESUME_AFTER_IDLE_MS = 6000;

/**
 * Carrusel horizontal de tarjetas de negocio "Disponibles ahora" —
 * scroll-snap nativo (sin librería nueva) con auto-rotación cada 4.5s.
 * Cada tarjeta usa `DiscoveryRow` (fila compacta, redediseño de
 * navegación global) — mismo componente que la lista filtrada de
 * pantalla completa (`FilteredListSheet`). Termina con una tarjeta
 * angosta "Ver todas" (no una fila/ícono aparte) que abre la hoja
 * inferior unificada (ver `onOpenList`).
 */
function DiscoveryBusinessCarousel({
  businesses,
  categoryTypeById,
  categoryNameById,
  activeId,
  onActiveChange,
  onOpenDetail,
  onViewOnMap,
  onCategoryClick,
  onOpenList,
}: {
  businesses: BusinessPin[];
  categoryTypeById: Map<number, CatalogType>;
  categoryNameById: Map<number, string>;
  activeId: string | null;
  onActiveChange: (business: BusinessPin) => void;
  onOpenDetail: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
  onCategoryClick: (business: BusinessPin) => void;
  onOpenList: () => void;
}) {
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
      // `container.scrollLeft` antes/después de llamarlo). El paso se
      // mide en vivo (distancia real entre las primeras dos tarjetas),
      // no un ancho de tarjeta hardcodeado ni el ancho completo del
      // contenedor — este último se probó primero y tiene su propio
      // bug: si `clientWidth` es mayor que `maxScrollLeft` (común
      // cuando caben casi todas las tarjetas en una ventana ancha),
      // sumar un contenedor entero siempre se pasa del máximo y
      // "avanza" de vuelta al mismo 0.
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
    <div
      ref={containerRef}
      onPointerDown={pauseAutoAdvance}
      onWheel={handleWheel}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {businesses.map((business) => {
        if (!business.id) return null;
        const isActive = activeId === business.id;

        return (
          <div
            key={business.id}
            ref={(el) => {
              if (el) cardRefs.current.set(business.id!, el);
              else cardRefs.current.delete(business.id!);
            }}
            data-business-id={business.id}
            className={`w-72 shrink-0 snap-center rounded-card border bg-background transition-colors ${
              isActive ? "border-terracota" : "border-border"
            }`}
          >
            <DiscoveryRow
              business={business}
              catalogType={business.categoryId != null ? (categoryTypeById.get(business.categoryId) ?? null) : null}
              categoryName={business.categoryId != null ? (categoryNameById.get(business.categoryId) ?? null) : null}
              onOpenDetail={onOpenDetail}
              onViewOnMap={onViewOnMap}
              onCategoryClick={onCategoryClick}
              onBeforeAction={pauseAutoAdvance}
            />
          </div>
        );
      })}

      {/* "Ver todas" — la entrada a la hoja inferior unificada
          (`FilteredListSheet`), como última tarjeta del carrusel en vez
          de una fila/ícono propio arriba (petición directa del usuario:
          más espacio vertical para el mapa). */}
      <div className="flex w-20 shrink-0 snap-center items-center justify-center">
        <button
          type="button"
          onClick={() => {
            pauseAutoAdvance();
            onOpenList();
          }}
          aria-label="Ver todas: Disponibles ahora"
          className="flex flex-col items-center gap-1 text-terracota"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
            <CaretRight size={18} weight="bold" />
          </span>
          <span className="font-sans text-caption font-medium">Ver todas</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Banner de descubrimiento "Disponibles ahora" (sin RF asociado,
 * petición directa del usuario). Vive arriba del mapa, en el mismo
 * lugar que el aviso de "no pudimos acceder a tu ubicación"
 * (map-screen.tsx decide el apilamiento) — nunca dentro del contenedor
 * del mapa, así que no compite con ZoneComparisonCard ni con
 * `MainFloatingNav`.
 *
 * Retroalimentación sobre el mapa (sin RF asociado): ya NO es un
 * selector entre familias (antes "Disponibles ahora"/"Favoritos abiertos
 * ahora" con una fila-título arriba y swipe entre las dos) — esa
 * navegación entre familias se consolidó dentro de la hoja inferior
 * unificada (`FilteredListSheet`, ver map-screen.tsx), alcanzable desde
 * "Ver todas" al final del carrusel, desde "Favoritos" en
 * `MainFloatingNav`, o desde el ícono de categoría de cualquier fila.
 * Este banner quedó reducido a solo eso: el carrusel de "Disponibles
 * ahora", sin ninguna fila propia arriba — más espacio vertical para el
 * mapa, pedido explícito del usuario.
 *
 * Sin negocios abiertos ahora, no se muestra nada — nada de estado
 * vacío forzado (pedido explícito desde la Fase 1).
 */
export function DiscoveryBanner({
  businesses,
  categoryTypeById,
  categoryNameById,
  activeId,
  onActiveChange,
  onOpenDetail,
  onViewOnMap,
  onCategoryClick,
  onOpenList,
}: DiscoveryBannerProps) {
  if (businesses.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface">
      <DiscoveryBusinessCarousel
        businesses={businesses}
        categoryTypeById={categoryTypeById}
        categoryNameById={categoryNameById}
        activeId={activeId}
        onActiveChange={onActiveChange}
        onOpenDetail={onOpenDetail}
        onViewOnMap={onViewOnMap}
        onCategoryClick={onCategoryClick}
        onOpenList={onOpenList}
      />
    </div>
  );
}
