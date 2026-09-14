"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CookingPot,
  Moped,
  NavigationArrow,
  Package,
  Storefront,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { logBusinessViewEvent, logContactClickEvent, logProductViewEvent } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/auth-context";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { BackButton } from "@/components/ui/back-button";
import { FavoriteButton } from "@/components/business/favorite-button";
import { ProductRow } from "@/components/business/product-row";
import { ReviewForm } from "@/components/business/review-form";
import { BusinessFeedbackPanel } from "@/components/business/business-feedback-panel";
import { PhoneVerificationPanel } from "@/components/business/phone-verification-panel";
import { LocationVisibilityToggle } from "@/components/business/location-visibility-toggle";
import { OwnDeliveryToggle } from "@/components/business/own-delivery-toggle";
import { HygieneBadge } from "@/components/business/hygiene-badge";
import { HygieneBadgeToggle } from "@/components/business/hygiene-badge-toggle";
import { BusinessQrCode } from "@/components/business/business-qr-code";
import { PhotoUploadControl } from "@/components/business/photo-upload-control";
import {
  resolveCatalogEmptyState,
  resolveCatalogSectionLabel,
  type CatalogType,
} from "@/lib/catalog/catalog-label";
import { pickLatestPhoto } from "@/lib/photos/pick-latest-photo";
import { uploadBusinessPhoto, deletePhoto, type UploadedPhoto } from "@/lib/api/photos";
import { getPhotoUploadErrorMessage, getPhotoDeleteErrorMessage } from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];

interface BusinessProfileScreenProps {
  profile: BusinessProfile;
  categoryName: string | null;
  /**
   * Expansión de alcance (ver CLAUDE.md sección 31) — decide el rótulo de
   * la sección de contenido ("Menú"/"Productos"/"Servicios") y el ícono
   * de respaldo cuando el negocio no tiene foto. `null` cuando la
   * categoría no resolvió (dato defensivo, no debería pasar en la
   * práctica ya que categoryId es obligatorio al crear un negocio).
   */
  catalogType: CatalogType | null;
}

// Ícono de respaldo del banner cuando el negocio no tiene foto — antes
// de la expansión de alcance (CLAUDE.md sección 31) siempre era
// CookingPot, asumiendo comida; ahora se elige según el tipo de
// categoría para no mostrar una olla en el perfil de un abogado o una
// costurera.
const HERO_FALLBACK_ICON_BY_TYPE: Record<CatalogType, typeof CookingPot> = {
  food: CookingPot,
  goods: Package,
  services: Briefcase,
};

/**
 * Perfil público de negocio (Épica F4, RF-012 a RF-014). Recibe el
 * perfil ya resuelto por el Server Component (src/app/negocios/[businessId]/page.tsx,
 * que también lo usa para generateMetadata) — no vuelve a pedirlo, para
 * no duplicar la llamada que ya hizo el render de servidor.
 */
export function BusinessProfileScreen({ profile, categoryName, catalogType }: BusinessProfileScreenProps) {
  const { user } = useAuth();
  // Estado local aparte de `profile` (inmutable, viene del Server
  // Component) — así, al confirmar el código, el aviso desaparece de
  // inmediato sin depender de recargar la página o volver a pedir el
  // perfil completo solo por este campo.
  const [phoneVerified, setPhoneVerified] = useState(Boolean(profile.phoneVerified));

  // Carga de fotos desde el frontend (sin épica asignada hasta ahora —
  // ver CLAUDE.md): estado local aparte de `profile` (inmutable), mismo
  // criterio que `phoneVerified` arriba — así una foto nueva/eliminada
  // se refleja de inmediato sin depender de recargar la página. Se
  // inicializa con pickLatestPhoto (la MÁS RECIENTE, no la primera —
  // ver el comentario en ese archivo) para partir del mismo estado que
  // ya se ve en el resto del perfil.
  const [heroPhoto, setHeroPhoto] = useState<UploadedPhoto | null>(() => {
    const photo = pickLatestPhoto(profile.photos, (p) => p.type === "business");
    return photo?.id && photo.url ? { id: photo.id, url: photo.url } : null;
  });
  const [productPhotos, setProductPhotos] = useState<Record<string, UploadedPhoto | null>>(() => {
    const inicial: Record<string, UploadedPhoto | null> = {};
    for (const product of profile.products ?? []) {
      if (!product.id) continue;
      const photo = pickLatestPhoto(profile.photos, (p) => p.type === "product" && p.productId === product.id);
      inicial[product.id] = photo?.id && photo.url ? { id: photo.id, url: photo.url } : null;
    }
    return inicial;
  });

  useEffect(() => {
    if (profile.id) logBusinessViewEvent(profile.id);
    // Una sola vez por montaje real de esta pantalla — no por cada
    // cambio de `profile` (que ni siquiera cambia de referencia acá).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La comparación es puramente del lado del cliente (useAuth(), después
  // de la hidratación) a propósito: el Server Component que resuelve
  // `profile` (src/app/negocios/[businessId]/page.tsx) usa el cliente
  // HTTP compartido, que nunca lleva el access token en memoria durante
  // el renderizado en servidor (token-store.ts es una variable de
  // módulo, exclusiva del navegador) — un campo "esPropietario" resuelto
  // ahí siempre daría false para el dueño real. `ownerId` no es un dato
  // sensible (ya viaja siempre en Business), así que comparar acá evita
  // depender de eso.
  const isOwner = Boolean(user?.id) && profile.ownerId === user?.id;

  const HeroFallbackIcon = catalogType ? HERO_FALLBACK_ICON_BY_TYPE[catalogType] : Storefront;
  const catalogSectionLabel = resolveCatalogSectionLabel(catalogType);
  const catalogEmptyState = resolveCatalogEmptyState(catalogType);
  const whatsappHref = buildWhatsAppLink(profile.contactPhone, profile.name);
  const directionsHref = profile.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${profile.location.latitude},${profile.location.longitude}`
    : null;

  return (
    <div className="flex flex-1 flex-col pb-24">
      <BackButton className="fixed left-3 top-3 z-40" />
      <FavoriteButton
        businessId={profile.id}
        ownerId={profile.ownerId}
        size={22}
        className="fixed right-3 top-3 z-40 h-10 w-10 border border-border bg-surface/90 shadow-lg backdrop-blur transition-colors hover:bg-background"
      />

      <div className="relative h-64 w-full bg-border">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto remota del negocio, sin dominio de next/image configurado todavía
          <img src={heroPhoto.url} alt={profile.name ?? "Negocio"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <HeroFallbackIcon size={64} weight="duotone" className="text-text-muted" />
          </div>
        )}
        <span
          className={`absolute bottom-3 left-3 rounded-full px-3 py-1 font-sans text-caption font-semibold uppercase tracking-wide text-white ${
            profile.isOpenNow ? "bg-verde" : "bg-text-muted"
          }`}
        >
          {profile.isOpenNow ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </div>

      <div className="flex flex-col gap-1 px-5 py-4">
        <h1 className="font-heading text-title-1 font-bold text-text">{profile.name}</h1>
        <p className="font-sans text-body-sm text-text-muted">
          {categoryName ?? "Comercio informal"}
          {profile.averageRating != null &&
            ` · ${profile.averageRating.toFixed(1)} ★ (${profile.reviewCount ?? 0} reseña${profile.reviewCount === 1 ? "" : "s"})`}
        </p>
        {profile.location?.referenceAddress && (
          <p className="font-sans text-body-sm text-text-muted">{profile.location.referenceAddress}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          {profile.ownDelivery && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-terracota/10 px-3 py-1 font-sans text-caption font-semibold text-terracota">
              <Moped size={16} weight="bold" />
              Hace domicilios propios
            </span>
          )}
          {profile.hygieneSelfDeclared && <HygieneBadge />}
        </div>
      </div>

      {isOwner && !phoneVerified && profile.id && (
        <div className="px-5 pb-4">
          <PhoneVerificationPanel
            businessId={profile.id}
            contactPhone={profile.contactPhone ?? null}
            onVerified={() => setPhoneVerified(true)}
          />
        </div>
      )}

      {isOwner && profile.id && profile.location && (
        <div className="px-5 pb-4">
          <LocationVisibilityToggle
            businessId={profile.id}
            initialShowExactLocation={Boolean(profile.location.showExactLocation)}
          />
        </div>
      )}

      {isOwner && profile.id && profile.name != null && profile.categoryId != null && (
        <div className="px-5 pb-4">
          <OwnDeliveryToggle
            businessId={profile.id}
            name={profile.name}
            description={profile.description ?? null}
            categoryId={profile.categoryId}
            contactPhone={profile.contactPhone ?? null}
            initialOwnDelivery={Boolean(profile.ownDelivery)}
          />
        </div>
      )}

      {isOwner && profile.id && profile.name != null && profile.categoryId != null && (
        <div className="px-5 pb-4">
          <HygieneBadgeToggle
            businessId={profile.id}
            name={profile.name}
            description={profile.description ?? null}
            categoryId={profile.categoryId}
            contactPhone={profile.contactPhone ?? null}
            initialHygieneSelfDeclared={Boolean(profile.hygieneSelfDeclared)}
          />
        </div>
      )}

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <BusinessQrCode businessId={profile.id} businessName={profile.name ?? "negocio"} />
        </div>
      )}

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <PhotoUploadControl
            id={`business-photo-${profile.id}`}
            label="Foto principal del negocio"
            currentPhoto={heroPhoto}
            uploadPhoto={(file) => uploadBusinessPhoto(profile.id!, file)}
            deletePhoto={deletePhoto}
            onPhotoChange={setHeroPhoto}
            uploadErrorMessage={getPhotoUploadErrorMessage}
            deleteErrorMessage={getPhotoDeleteErrorMessage}
          />
        </div>
      )}

      <section className="flex flex-col gap-3 px-5 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">{catalogSectionLabel}</h2>
        {(profile.products?.length ?? 0) === 0 && (
          <p className="font-sans text-body-sm text-text-muted">{catalogEmptyState}</p>
        )}
        {profile.products?.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            photoUrl={productPhotos[product.id ?? ""]?.url ?? null}
            isOwner={isOwner}
            currentPhoto={product.id ? (productPhotos[product.id] ?? null) : null}
            onPhotoChange={(photo) => {
              if (!product.id) return;
              setProductPhotos((prev) => ({ ...prev, [product.id!]: photo }));
            }}
            onExpand={(expandedProduct) => {
              if (profile.id && expandedProduct.id) logProductViewEvent(profile.id, expandedProduct.id);
            }}
          />
        ))}
      </section>

      {profile.id && isOwner && (
        <div className="px-5 pb-4">
          <BusinessFeedbackPanel businessId={profile.id} />
        </div>
      )}

      {profile.id && !isOwner && user && (
        <div className="px-5 pb-4">
          <ReviewForm businessId={profile.id} catalogType={catalogType} />
        </div>
      )}

      {profile.id && !isOwner && !user && (
        <div className="mx-5 mb-4 rounded-card border border-border bg-surface px-4 py-3 text-center">
          <p className="font-sans text-body-sm text-text-muted">
            <Link href="/login" className="font-medium text-terracota underline">
              Inicia sesión
            </Link>{" "}
            para calificar este negocio.
          </p>
        </div>
      )}

      <FloatingActionStack
        primary={
          whatsappHref
            ? {
                icon: <WhatsappLogo size={32} weight="fill" />,
                label: "Contactar por WhatsApp",
                href: whatsappHref,
                onClick: () => {
                  if (profile.id) logContactClickEvent(profile.id);
                },
              }
            : null
        }
        secondary={
          directionsHref
            ? {
                icon: <NavigationArrow size={22} weight="fill" />,
                label: "Cómo llegar",
                href: directionsHref,
              }
            : null
        }
      />
    </div>
  );
}

function buildWhatsAppLink(
  phone: string | null | undefined,
  businessName: string | null | undefined,
): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const message = encodeURIComponent(
    `Hola, te escribo desde Ruteando. Vi tu negocio "${businessName ?? ""}" y quiero preguntarte por tus productos.`,
  );
  return `https://wa.me/${digits}?text=${message}`;
}
