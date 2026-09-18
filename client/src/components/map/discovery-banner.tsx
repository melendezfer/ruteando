"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
import { CheckCircle, Heart, Info, MapPin, X } from "@phosphor-icons/react/dist/ssr";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { CATALOG_ICON_BY_TYPE, DEFAULT_CATALOG_ICON } from "@/lib/catalog/catalog-icons";
import type { CatalogType } from "@/lib/catalog/catalog-label";
import { getCategoryPinColor } from "@/lib/map/category-pin-colors";
import { buildDirectionsUrl } from "@/lib/format/directions";
import { formatDistance } from "@/lib/format/distance";
import type { BusinessPin } from "@/components/map/leaflet-map";

/**
 * Familias del banner de descubrimiento (sin RF asociado, petición
 * directa del usuario) — hoy solo estas dos tienen datos reales
 * detrás: "Disponibles ahora" (GET /businesses/nearby u openNow=true,
 * Fase 1) y "Favoritos abiertos ahora" (GET /users/me/favorites con el
 * mismo openNow=true). Promociones y Eventos no aparecen todavía —
 * ni siquiera como "próximamente" — porque no tienen ningún endpoint ni
 * dato detrás; se agregan solos cuando sus propios PRs de backend
 * existan, sin tocar este archivo más que para sumar un valor al enum.
 */
export type DiscoveryFamilyId = "available_now" | "favorites_open_now";

export interface DiscoveryFamilyData {
  id: DiscoveryFamilyId;
  /** Ya filtrados a `openNow=true` y ordenados (ver lib/discovery/available-now.ts) — este componente no vuelve a decidir quién entra ni en qué orden. */
  businesses: BusinessPin[];
}

interface DiscoveryBannerProps {
  /** Ya filtradas a las que tienen al menos un negocio — una familia sin negocios no aparece ni como pestaña vacía (mismo criterio que "sin negocios, no se muestra nada" de la Fase 1). */
  families: DiscoveryFamilyData[];
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

const FAMILY_NAME: Record<DiscoveryFamilyId, string> = {
  available_now: "Disponibles ahora",
  favorites_open_now: "Favoritos abiertos ahora",
};

/** 🟢 disponibles / ❤️ favoritos — mismo ícono/color que ya usa el resto de la app para cada concepto (AvailabilityConfirmedBadge, FavoriteButton), no uno nuevo inventado acá. */
function FamilyIcon({ id, size = 18 }: { id: DiscoveryFamilyId; size?: number }) {
  if (id === "favorites_open_now") return <Heart size={size} weight="fill" className="text-terracota" />;
  return <CheckCircle size={size} weight="fill" className="text-verde" />;
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
 * Contenido de una fila de negocio — ícono de categoría, nombre,
 * distancia, estado y los dos accesos ("Ver en mapa/ubicación/zona" +
 * "Cómo llegar") — compartido entre la tarjeta horizontal del carrusel
 * (DiscoveryBusinessCarousel) y la fila vertical de la vista rápida
 * (DiscoveryQuickViewSheet). Solo cambia el contenedor que envuelve esto
 * en cada caso (tarjeta con borde de ancho fijo vs. fila de ancho
 * completo separada por un divisor) — nunca el contenido en sí.
 */
function DiscoveryBusinessRowContent({
  business,
  categoryTypeById,
  onOpenDetail,
  onViewOnMap,
  onBeforeAction,
}: {
  business: BusinessPin;
  categoryTypeById: Map<number, CatalogType>;
  onOpenDetail: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
  /** Gancho extra antes de cada acción — el carrusel lo usa para pausar el auto-avance; la vista rápida no lo necesita. */
  onBeforeAction?: () => void;
}) {
  const catalogType = business.categoryId != null ? categoryTypeById.get(business.categoryId) ?? null : null;
  const CategoryIcon = catalogType ? CATALOG_ICON_BY_TYPE[catalogType] : DEFAULT_CATALOG_ICON;
  const color = getCategoryPinColor(business.categoryId, catalogType);
  const statusText = business.availabilityConfirmedAt ? "Vendiendo ahora" : "Abierto";
  const locationLabel = resolveLocationActionLabel(business, catalogType);
  const hasCoords = typeof business.latitude === "number" && typeof business.longitude === "number";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onBeforeAction?.();
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
            {typeof business.distanceMeters === "number" && <span>{formatDistance(business.distanceMeters)}</span>}
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
            onBeforeAction?.();
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
    </>
  );
}

/**
 * Carrusel horizontal de tarjetas de negocio de UNA familia — scroll-snap
 * nativo (sin librería nueva) con auto-rotación cada 4.5s. Montado con
 * `key={family.id}` desde el padre para que cambiar de familia lo
 * remonte entero (auto-avance, pausa e IntersectionObserver arrancan
 * limpios para la nueva lista, sin arrastrar el estado de la anterior).
 */
function DiscoveryBusinessCarousel({
  businesses,
  categoryTypeById,
  activeId,
  onActiveChange,
  onOpenDetail,
  onViewOnMap,
}: {
  businesses: BusinessPin[];
  categoryTypeById: Map<number, CatalogType>;
  activeId: string | null;
  onActiveChange: (business: BusinessPin) => void;
  onOpenDetail: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
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
            className={`w-64 shrink-0 snap-center rounded-card border bg-background transition-colors ${
              isActive ? "border-terracota" : "border-border"
            }`}
          >
            <DiscoveryBusinessRowContent
              business={business}
              categoryTypeById={categoryTypeById}
              onOpenDetail={onOpenDetail}
              onViewOnMap={onViewOnMap}
              onBeforeAction={pauseAutoAdvance}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Nivel "12" del spec de Jose — vista rápida con MÁS elementos de la
 * misma familia, en lista vertical (no otro carrusel horizontal más
 * chico). Reusa la MISMA lista ya fetcheada para el carrusel (hasta el
 * límite existente, ver map-screen.tsx) — no dispara un fetch aparte
 * con un límite más alto: mostrarlos en una lista vertical, sin la
 * restricción de "cuántos caben de lado" de una fila horizontal, ya es
 * "más" en el sentido que pedía el spec.
 */
function DiscoveryQuickViewSheet({
  family,
  categoryTypeById,
  onClose,
  onOpenDetail,
  onViewOnMap,
}: {
  family: DiscoveryFamilyData;
  categoryTypeById: Map<number, CatalogType>;
  onClose: () => void;
  onOpenDetail: (business: BusinessPin) => void;
  onViewOnMap: (business: BusinessPin) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discovery-quick-view-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[75vh] w-full max-w-sm flex-col gap-1 rounded-t-card bg-surface p-4 shadow-xl sm:rounded-card"
      >
        <div className="flex items-center justify-between pb-2">
          <h2 id="discovery-quick-view-title" className="font-heading text-title-2 font-bold text-text">
            {FAMILY_NAME[family.id]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-background hover:text-text"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
        <div className="flex flex-col divide-y divide-border overflow-y-auto">
          {family.businesses.map((business) => (
            <DiscoveryBusinessRowContent
              key={business.id}
              business={business}
              categoryTypeById={categoryTypeById}
              onOpenDetail={onOpenDetail}
              onViewOnMap={onViewOnMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Nivel 1 del banner de descubrimiento (sin RF asociado, petición
 * directa del usuario). Vive arriba del mapa, en el mismo lugar que el
 * aviso de "no pudimos acceder a tu ubicación" (map-screen.tsx decide
 * el apilamiento) — nunca dentro del contenedor del mapa, así que no
 * compite con ZoneComparisonCard ni con FloatingActionStack.
 *
 * Con una sola familia con datos, la fila superior es estática (nombre +
 * ícono de esa familia, sin nada que deslizar). Con dos o más (hoy:
 * "Disponibles ahora" y "Favoritos abiertos ahora"), esa fila se vuelve
 * su propio carrusel scroll-snap — deslizarla cambia de familia sin
 * afectar el carrusel de tarjetas de negocio de abajo, que sigue
 * deslizándose por separado entre los negocios de la familia activa.
 * Tocar el ícono de familia (derecha) también avanza a la siguiente,
 * como atajo accesible sin depender de un gesto de swipe (mouse,
 * teclado). Tocar el ⓘ (izquierda) abre la vista rápida (nivel 12 del
 * spec de Jose) con más elementos de esa misma familia — tocar una
 * tarjeta de negocio, en el carrusel o en la vista rápida, sigue
 * abriendo el detalle de ESE negocio: son tres acciones distintas de la
 * misma fila/carrusel, no una.
 *
 * Sin ninguna familia con negocios, no se muestra nada — nada de estado
 * vacío forzado (pedido explícito desde la Fase 1).
 */
export function DiscoveryBanner({
  families,
  categoryTypeById,
  activeId,
  onActiveChange,
  onOpenDetail,
  onViewOnMap,
}: DiscoveryBannerProps) {
  const [activeFamilyIndex, setActiveFamilyIndex] = useState(0);
  const [quickViewFamilyId, setQuickViewFamilyId] = useState<DiscoveryFamilyId | null>(null);
  const familyContainerRef = useRef<HTMLDivElement | null>(null);
  const familyRefs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    const container = familyContainerRef.current;
    if (!container || families.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce<IntersectionObserverEntry | null>(
          (best, entry) => (!best || entry.intersectionRatio > best.intersectionRatio ? entry : best),
          null,
        );
        if (!mostVisible || mostVisible.intersectionRatio < 0.5) return;
        const index = Number(mostVisible.target.getAttribute("data-family-index"));
        if (!Number.isNaN(index)) setActiveFamilyIndex(index);
      },
      { root: container, threshold: [0.5, 0.75, 1] },
    );

    familyRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [families.length]);

  // Si la familia activa desaparece (ej. ya no quedan favoritos abiertos
  // ahora mismo) y el índice queda fuera de rango, cae a la primera
  // disponible — sin esto, un índice obsoleto dejaría el carrusel de
  // tarjetas vacío aunque sí haya otra familia con negocios.
  const safeActiveFamilyIndex = activeFamilyIndex < families.length ? activeFamilyIndex : 0;
  const activeFamily = families[safeActiveFamilyIndex] ?? null;
  const quickViewFamily = families.find((family) => family.id === quickViewFamilyId) ?? null;

  function goToFamilyIndex(index: number) {
    familyRefs.current.get(index)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    // No hace falta setActiveFamilyIndex acá — el IntersectionObserver de
    // arriba lo detecta solo cuando el scroll termine, mismo criterio ya
    // usado para el swipe manual entre tarjetas de negocio.
  }

  if (families.length === 0 || !activeFamily) return null;

  return (
    <div className="border-b border-border bg-surface">
      {families.length > 1 ? (
        <div
          ref={familyContainerRef}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {families.map((family, index) => (
            <div
              key={family.id}
              ref={(el) => {
                if (el) familyRefs.current.set(index, el);
                else familyRefs.current.delete(index);
              }}
              data-family-index={index}
              className="flex w-full shrink-0 snap-center items-center justify-between gap-2 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => setQuickViewFamilyId(family.id)}
                aria-label={`Ver más de ${FAMILY_NAME[family.id]}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-background hover:text-text"
              >
                <Info size={18} weight="bold" />
              </button>
              <span className="flex-1 truncate text-center font-sans text-body-sm font-semibold text-text">
                {FAMILY_NAME[family.id]}
              </span>
              <button
                type="button"
                onClick={() => goToFamilyIndex((index + 1) % families.length)}
                aria-label="Cambiar de familia"
                className="flex h-7 w-7 shrink-0 items-center justify-center"
              >
                <FamilyIcon id={family.id} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setQuickViewFamilyId(activeFamily.id)}
            aria-label={`Ver más de ${FAMILY_NAME[activeFamily.id]}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-background hover:text-text"
          >
            <Info size={18} weight="bold" />
          </button>
          <span className="flex-1 truncate text-center font-sans text-body-sm font-semibold text-text">
            {FAMILY_NAME[activeFamily.id]}
          </span>
          <FamilyIcon id={activeFamily.id} />
        </div>
      )}

      <DiscoveryBusinessCarousel
        key={activeFamily.id}
        businesses={activeFamily.businesses}
        categoryTypeById={categoryTypeById}
        activeId={activeId}
        onActiveChange={onActiveChange}
        onOpenDetail={onOpenDetail}
        onViewOnMap={onViewOnMap}
      />

      {quickViewFamily && (
        <DiscoveryQuickViewSheet
          family={quickViewFamily}
          categoryTypeById={categoryTypeById}
          onClose={() => setQuickViewFamilyId(null)}
          onOpenDetail={(business) => {
            setQuickViewFamilyId(null);
            onOpenDetail(business);
          }}
          onViewOnMap={(business) => {
            setQuickViewFamilyId(null);
            onViewOnMap(business);
          }}
        />
      )}
    </div>
  );
}
