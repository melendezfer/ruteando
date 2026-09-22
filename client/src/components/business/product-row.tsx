"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp, PencilSimple, Tag, Trash } from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";
import { formatCOP } from "@/lib/format/currency";
import { formatRelativeTimeShort } from "@/lib/format/relative-time";
import { PhotoUploadControl } from "@/components/business/photo-upload-control";
import { uploadProductPhoto, deletePhoto, type UploadedPhoto } from "@/lib/api/photos";
import { deleteProduct } from "@/lib/api/products";
import { describeOfferValidUntil } from "@/lib/offers/offer-validity-status";
import {
  getPhotoUploadErrorMessage,
  getPhotoDeleteErrorMessage,
  getProductDeleteErrorMessage,
} from "@/lib/api/error-messages";

type Product = components["schemas"]["Product"];

interface ProductRowProps {
  product: Product;
  /** Foto de solo lectura para un visitante que no es el dueño — ignorada cuando `isOwner`. */
  photoUrl: string | null;
  /** Sin épica de frontend asignada hasta ahora (petición directa del usuario) — solo el dueño puede subir/reemplazar/eliminar, editar o borrar. */
  isOwner: boolean;
  currentPhoto: UploadedPhoto | null;
  onPhotoChange: (photo: UploadedPhoto | null) => void;
  /** Abre el formulario de edición en business-profile-screen.tsx (el formulario en sí es un modal, un único componente reusado también para "Agregar"). */
  onEdit: (product: Product) => void;
  /** Notifica al padre DESPUÉS de un borrado ya exitoso — este componente hace la llamada a la API y su propio confirm/loading/error, mismo criterio que PhotoUploadControl. */
  onDeleted: (productId: string) => void;
  onExpand: (product: Product) => void;
  /**
   * Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado
   * — ver CLAUDE.md, migración productos-tipo-oferta. Nombre del tipo de
   * oferta ya resuelto por business-profile-screen.tsx (GET /offer-types,
   * una sola vez para todas las filas — mismo criterio que
   * categoryNameById en map-screen.tsx) contra `product.offerTypeId`.
   * `null` cuando el producto no tiene tipo elegido (sigue pudiendo ser
   * una oferta sin tipo — ver `product.validFrom`) o cuando no se
   * encontró (tipo desactivado después de que el producto ya lo tenía).
   */
  offerTypeName: string | null;
}

/**
 * Ítem de catálogo (plato, producto o servicio, según el tipo de
 * categoría del negocio — ver CLAUDE.md sección 31 y
 * client/src/lib/catalog/catalog-label.ts), expandible in-place
 * (CLAUDE.md sección 17: "cada plato se expande al tocarlo... sin
 * navegar a otra pantalla" — el mismo patrón de interacción aplica sin
 * cambios a un producto o a un servicio). `onExpand` se dispara cada vez
 * que se abre (no solo la primera vez) — es el mismo criterio que un
 * clic de analítica normal, no un "visto una sola vez".
 */
export function ProductRow({
  product,
  photoUrl,
  isOwner,
  currentPhoto,
  onPhotoChange,
  onEdit,
  onDeleted,
  onExpand,
  offerTypeName,
}: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next) onExpand(product);
  }

  async function handleDelete() {
    if (!product.id) return;
    const confirmado = window.confirm(
      `¿Eliminar "${product.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    setDeleting(true);
    setDeleteError(null);
    const result = await deleteProduct(product.id);
    setDeleting(false);

    if (!result.ok) {
      setDeleteError(getProductDeleteErrorMessage(result.status));
      return;
    }
    onDeleted(product.id);
  }

  // Ofertas con vigencia, sin RF asociado (ver CLAUDE.md, migración
  // productos-tipo-oferta): el badge es tappable (navega a "más {tipo}
  // cerca") solo cuando el producto tiene un offerTypeId elegido — un
  // <Link>/<button> DENTRO del <button> de expandir/colapsar sería HTML
  // inválido (interactivo anidado, mismo problema ya resuelto en
  // business-card.tsx con FavoriteButton) y además el toque burbujearía
  // al padre, así que vive como hermano del botón, no adentro — con
  // stopPropagation() como red de seguridad adicional (mismo criterio).
  const offerBadge = product.validFrom && (
    <span className="inline-flex items-center gap-1 rounded-full bg-terracota/10 px-2 py-1 font-sans text-caption font-medium text-terracota">
      <Tag size={12} weight="bold" />
      {offerTypeName ?? "Oferta"}
    </span>
  );

  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-heading text-title-2 font-semibold text-text">{product.name}</span>
            <span className="font-sans text-body-sm text-text-muted">
              {product.price !== undefined ? formatCOP(product.price) : ""}
            </span>
            {product.availabilityUpdatedAt && (
              <span className="font-sans text-caption text-text-muted">
                {product.available === false ? "No disponible" : "Disponible"}{" "}
                {formatRelativeTimeShort(product.availabilityUpdatedAt)}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {product.available === false && (
              <span className="rounded-full bg-ambar/20 px-2 py-1 font-sans text-caption font-medium uppercase tracking-wide text-ambar">
                No disponible
              </span>
            )}
            {expanded ? (
              <CaretUp size={20} className="text-text-muted" />
            ) : (
              <CaretDown size={20} className="text-text-muted" />
            )}
          </div>
        </button>
        {product.validFrom &&
          (product.offerTypeId != null ? (
            <Link
              href={`/mapa?offerTypeId=${product.offerTypeId}`}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Ver más ${offerTypeName ?? "ofertas"} cerca`}
              className="shrink-0"
            >
              {offerBadge}
            </Link>
          ) : (
            <span className="shrink-0">{offerBadge}</span>
          ))}
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
          {isOwner && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onEdit(product)}
                aria-label={`Editar ${product.name ?? "ítem"}`}
                className="flex h-9 w-9 items-center justify-center rounded-input border border-border text-text-muted transition-colors hover:bg-background"
              >
                <PencilSimple size={16} weight="bold" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-label={`Eliminar ${product.name ?? "ítem"}`}
                className="flex h-9 w-9 items-center justify-center rounded-input border border-border text-rojo transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash size={16} weight="bold" />
              </button>
            </div>
          )}
          {deleteError && <p className="font-sans text-body-sm text-rojo">{deleteError}</p>}
          {product.validFrom && (
            <p className="font-sans text-body-sm font-medium text-terracota">
              {describeOfferValidUntil(product.validUntil)}
            </p>
          )}

          {isOwner && product.id ? (
            <PhotoUploadControl
              id={`product-photo-${product.id}`}
              label="Foto"
              currentPhoto={currentPhoto}
              uploadPhoto={(file) => uploadProductPhoto(product.id!, file)}
              deletePhoto={deletePhoto}
              onPhotoChange={onPhotoChange}
              uploadErrorMessage={getPhotoUploadErrorMessage}
              deleteErrorMessage={getPhotoDeleteErrorMessage}
            />
          ) : (
            photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- foto remota de ancho variable, no vale la pena el pipeline de next/image para un solo ítem de catálogo
              <img
                src={photoUrl}
                alt={product.name ?? "Producto"}
                className="h-40 w-full rounded-input object-cover"
              />
            )
          )}
          <p className="font-sans text-body-sm text-text">
            {product.description ?? "Este ítem todavía no tiene descripción."}
          </p>
        </div>
      )}
    </div>
  );
}
