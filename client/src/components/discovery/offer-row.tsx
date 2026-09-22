"use client";

import type { components } from "@/lib/api/schema";
import { OFFER_TYPE_ICON_BY_NAME, DEFAULT_OFFER_TYPE_ICON } from "@/lib/catalog/offer-type-icons";
import { describeOfferValidUntil } from "@/lib/offers/offer-validity-status";
import { formatDistance } from "@/lib/format/distance";
import type { BusinessPin } from "@/components/map/leaflet-map";

type OfferType = components["schemas"]["OfferType"];

/**
 * Un producto con vigencia activa de un negocio, junto con el negocio
 * completo al que pertenece (`business`) — reusar el `BusinessPin` tal
 * cual (en vez de solo `businessId`) es lo que deja que tocar la fila
 * reutilice `onViewOnMap`/navegar al perfil sin necesitar un fetch
 * aparte para resolver el negocio. Vive acá (no en discovery-banner.tsx,
 * que ya no tiene nada que ver con ofertas desde la retroalimentación de
 * navegación global, sección 54 de CLAUDE.md) porque `OfferRow` es el
 * componente más directamente dueño de esta forma.
 */
export interface DiscoveryOffer {
  /** `${businessId}-${índice}` — compuesto, nunca un id persistente del backend. */
  id: string;
  business: BusinessPin;
  name: string;
  offerTypeId: number | null;
  validUntil: string | null;
}

interface OfferRowProps {
  offer: DiscoveryOffer;
  offerType: OfferType | null;
  onOpenDetail: (offer: DiscoveryOffer) => void;
}

/**
 * Fila compacta de una OFERTA (no de un negocio) — "Cerca de ti ahora"
 * (sin RF asociado, petición directa del usuario, ver CLAUDE.md): ícono
 * del tipo de oferta, nombre del plato/promoción/evento, el negocio al
 * que pertenece + distancia, y cuánto le queda de vigencia. Tocar la
 * fila abre el detalle del NEGOCIO dueño de la oferta (mismo destino que
 * tocar su pin/fila en las otras dos familias) — no hay una pantalla de
 * detalle de un producto individual en este proyecto.
 */
export function OfferRow({ offer, offerType, onOpenDetail }: OfferRowProps) {
  // Lookup directo (no resolveOfferTypeIcon) — dentro del cuerpo de este
  // componente, no de un callback .map(): ver el comentario de esa
  // función en lib/catalog/offer-type-icons.ts sobre por qué.
  const Icon = offerType?.icon ? (OFFER_TYPE_ICON_BY_NAME[offerType.icon] ?? DEFAULT_OFFER_TYPE_ICON) : DEFAULT_OFFER_TYPE_ICON;
  const distanceMeters = offer.business.distanceMeters;

  return (
    <button
      type="button"
      onClick={() => onOpenDetail(offer)}
      className="flex w-full flex-col gap-1.5 rounded-card border border-border bg-background px-3 py-2.5 text-left"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mostaza/15 text-mostaza">
          <Icon size={16} weight="bold" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-sans text-body-sm font-semibold text-text">{offer.name}</span>
          <span className="truncate font-sans text-caption text-text-muted">
            {offer.business.name}
            {typeof distanceMeters === "number" ? ` · ${formatDistance(distanceMeters)}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pl-10">
        <span className="font-sans text-caption text-text-muted">{offerType?.name ?? "Oferta"}</span>
        <span className="font-sans text-caption font-medium text-terracota">
          {describeOfferValidUntil(offer.validUntil)}
        </span>
      </div>
    </button>
  );
}
