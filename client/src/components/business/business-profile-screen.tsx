"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Chair,
  Compass,
  Gear,
  Moped,
  NavigationArrow,
  Plus,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { CATALOG_ICON_BY_TYPE, DEFAULT_CATALOG_ICON } from "@/lib/catalog/catalog-icons";
import { logBusinessViewEvent, logContactClickEvent, logProductViewEvent } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/auth-context";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { BackButton } from "@/components/ui/back-button";
import { FavoriteButton } from "@/components/business/favorite-button";
import { BusinessStatusBanner } from "@/components/business/business-status-banner";
import { AvailabilityConfirmedBadge } from "@/components/business/availability-confirmed-badge";
import { AvailabilityRequestButton } from "@/components/business/availability-request-button";
import { VendorAvailabilityRequestsPanel } from "@/components/business/vendor-availability-requests-panel";
import { ProductRow } from "@/components/business/product-row";
import { ReviewForm } from "@/components/business/review-form";
import { BusinessFeedbackPanel } from "@/components/business/business-feedback-panel";
import { PhoneVerificationPanel } from "@/components/business/phone-verification-panel";
import { LocationVisibilityToggle } from "@/components/business/location-visibility-toggle";
import { Skeleton } from "@/components/discovery/skeleton";
import { OwnDeliveryToggle } from "@/components/business/own-delivery-toggle";
import { SeatingToggle } from "@/components/business/seating-toggle";
import { MobilityToggle } from "@/components/business/mobility-toggle";
import { LiveLocationToggle } from "@/components/business/live-location-toggle";
import { LocationSlotsEditor } from "@/components/business/location-slots-editor";
import { HygieneBadge } from "@/components/business/hygiene-badge";
import { HygieneBadgeToggle } from "@/components/business/hygiene-badge-toggle";
import { BusinessQrCode } from "@/components/business/business-qr-code";
import { PhotoUploadControl } from "@/components/business/photo-upload-control";
import { ProductForm, type ProductFormValues } from "@/components/business/product-form";
import { ProductPhotoStep } from "@/components/business/product-photo-step";
import {
  resolveCatalogEmptyState,
  resolveCatalogSectionLabel,
  resolveItemNoun,
  type CatalogType,
} from "@/lib/catalog/catalog-label";
import { pickLatestPhoto } from "@/lib/photos/pick-latest-photo";
import { buildDirectionsUrl } from "@/lib/format/directions";
import { uploadBusinessPhoto, deletePhoto, type UploadedPhoto } from "@/lib/api/photos";
import { createProduct, updateProduct } from "@/lib/api/products";
import { api } from "@/lib/api/client";
import {
  getPhotoUploadErrorMessage,
  getPhotoDeleteErrorMessage,
  getProductFormErrorMessage,
} from "@/lib/api/error-messages";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];
type Product = components["schemas"]["Product"];

type ProductFormState =
  | { mode: "create" }
  | { mode: "edit"; product: Product }
  // Segundo paso tras crear (ver ProductPhotoStep) — el producto en sí
  // ya existe de verdad en el backend en este punto, solo falta que el
  // vendedor decida si le agrega una foto antes de cerrar el modal.
  | { mode: "create-photo"; product: Product };

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

// Leaflet toca `window`/`document` al cargarse — mismo motivo exacto que
// map-screen.tsx documenta para LeafletMap: este componente ("use client")
// igual recibe un primer render en el servidor desde
// negocios/[businessId]/page.tsx (Server Component), así que importar
// Leaflet en el módulo de arriba rompería ese render. `ssr: false` lo
// difiere al navegador.
const LocationPinEditor = dynamic(
  () => import("@/components/business/location-pin-editor").then((mod) => mod.LocationPinEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-56 w-full rounded-card" />,
  },
);

/**
 * Perfil público de negocio (Épica F4, RF-012 a RF-014). Recibe el
 * perfil ya resuelto por el Server Component (src/app/negocios/[businessId]/page.tsx,
 * que también lo usa para generateMetadata) — no vuelve a pedirlo, para
 * no duplicar la llamada que ya hizo el render de servidor.
 */
export function BusinessProfileScreen({ profile, categoryName, catalogType }: BusinessProfileScreenProps) {
  const { user } = useAuth();
  const router = useRouter();
  // Estado local aparte de `profile` (inmutable, viene del Server
  // Component) — así, al confirmar el código, el aviso desaparece de
  // inmediato sin depender de recargar la página o volver a pedir el
  // perfil completo solo por este campo.
  const [phoneVerified, setPhoneVerified] = useState(Boolean(profile.phoneVerified));

  // Ajustar ubicación en el mapa (sin RF asociado — ver CLAUDE.md):
  // mismo criterio que phoneVerified arriba — así, al guardar una nueva
  // posición del pin (LocationPinEditor), "Cómo llegar" y la dirección
  // de referencia mostrada se actualizan de inmediato sin recargar.
  const [location, setLocation] = useState(profile.location ?? null);
  // Modalidad vigente (el interruptor la cambia sin recargar) — decide si
  // se muestran los paneles de ambulante.
  const [mobility, setMobility] = useState(profile.mobility ?? "itinerant");

  // "Vendiendo ahora" (Fase 2, sin RF asociado — ver CLAUDE.md sección
  // 11/37): mismo criterio que phoneVerified arriba — así, cuando el
  // vendedor confirma mientras el consumidor sigue mirando la pantalla
  // (AvailabilityRequestButton#onConfirmed), el badge aparece de
  // inmediato sin depender de recargar la página.
  const [availabilityConfirmedAt, setAvailabilityConfirmedAt] = useState<string | null>(
    profile.availabilityConfirmedAt ?? null,
  );

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

  // Gestión del catálogo (agregar/editar/eliminar, sin épica de frontend
  // asignada hasta ahora — petición directa del usuario): estado local
  // aparte de `profile.products` (inmutable), mismo criterio que
  // heroPhoto/productPhotos arriba — así la lista se actualiza sola tras
  // crear, editar o borrar, sin recargar la página completa.
  const [products, setProducts] = useState<Product[]>(profile.products ?? []);
  // Ofertas con vigencia (menú/promoción/combo/evento), sin RF asociado —
  // ver CLAUDE.md, migración productos-tipo-oferta. Una sola vez, para
  // todas las filas del catálogo a la vez — mismo criterio que
  // categoryNameById en map-screen.tsx: sin esto, cada ProductRow tendría
  // que pedir su propio nombre de tipo por separado.
  const [offerTypeNameById, setOfferTypeNameById] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    let ignore = false;
    api.GET("/offer-types").then(({ data }) => {
      if (!ignore && data) {
        setOfferTypeNameById(new Map(data.map((t) => [t.id!, t.name!])));
      }
    });
    return () => {
      ignore = true;
    };
  }, []);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [productFormSubmitting, setProductFormSubmitting] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [productFormFieldErrors, setProductFormFieldErrors] = useState<Record<string, string>>({});
  // Foto que se sube durante el paso "create-photo" (ver ProductPhotoStep)
  // — se guarda acá, aparte, hasta que se confirma con "Listo": recién
  // ahí se vuelca a `productPhotos` junto con el producto nuevo a
  // `products`, los dos a la vez (ver finishProductCreation).
  const [pendingProductPhoto, setPendingProductPhoto] = useState<UploadedPhoto | null>(null);

  function closeProductForm() {
    setProductForm(null);
    setProductFormError(null);
    setProductFormFieldErrors({});
    setPendingProductPhoto(null);
  }

  async function handleProductFormSubmit(values: ProductFormValues) {
    if (!productForm || productForm.mode === "create-photo" || !profile.id) return;

    const name = values.name.trim();
    const priceNumber = Number(values.price);
    if (!name || Number.isNaN(priceNumber) || priceNumber < 0) {
      setProductFormError("Revisa el nombre y el precio.");
      return;
    }

    setProductFormSubmitting(true);
    setProductFormError(null);
    setProductFormFieldErrors({});

    const body = {
      name,
      price: priceNumber,
      description: values.description.trim() ? values.description.trim() : undefined,
      available: values.available,
      offerTypeId: values.offerTypeId,
      validFrom: values.validFrom,
      validUntil: values.validUntil,
    };

    const result =
      productForm.mode === "create"
        ? await createProduct(profile.id, body)
        : await updateProduct(productForm.product.id!, body);

    setProductFormSubmitting(false);

    if (!result.ok || !result.product) {
      setProductFormError(getProductFormErrorMessage(result.status));
      setProductFormFieldErrors(result.fieldErrors);
      return;
    }

    if (productForm.mode === "create") {
      // Corrige un hueco real (petición directa del usuario): antes el
      // modal se cerraba acá mismo y había que volver a entrar al
      // producto ya creado para poder agregarle una foto. Ahora, en vez
      // de cerrar, el modal cambia a un segundo paso (ProductPhotoStep)
      // — ni `products` ni `productFormError`/etc. se tocan todavía; eso
      // pasa recién en finishProductCreation(), cuando el vendedor
      // confirma "Listo"/"Continuar sin foto".
      setProductForm({ mode: "create-photo", product: result.product });
    } else {
      setProducts((prev) => prev.map((p) => (p.id === result.product!.id ? result.product! : p)));
      closeProductForm();
    }
  }

  /**
   * "Listo"/"Continuar sin foto" en ProductPhotoStep — el producto ya
   * existía de verdad en el backend desde handleProductFormSubmit; acá
   * recién se refleja en el estado local (products + productPhotos, los
   * dos juntos) y se cierra el modal.
   */
  function finishProductCreation() {
    if (!productForm || productForm.mode !== "create-photo") return;
    const created = productForm.product;
    setProducts((prev) => [...prev, created]);
    if (created.id && pendingProductPhoto) {
      setProductPhotos((prev) => ({ ...prev, [created.id!]: pendingProductPhoto }));
    }
    closeProductForm();
  }

  /**
   * ProductRow ya hizo el DELETE real (mismo criterio "self-contained"
   * que PhotoUploadControl) — esto solo actualiza el estado local: saca
   * el producto de la lista y limpia su entrada en productPhotos, para
   * no dejar una referencia de foto colgando de un producto que ya no
   * existe (mismo espíritu de "reemplaza, no acumula" que la carga de
   * fotos, aplicado acá al estado del cliente).
   */
  function handleProductDeleted(productId: string) {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setProductPhotos((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

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

  const HeroFallbackIcon = catalogType ? CATALOG_ICON_BY_TYPE[catalogType] : DEFAULT_CATALOG_ICON;
  const catalogSectionLabel = resolveCatalogSectionLabel(catalogType);
  const catalogEmptyState = resolveCatalogEmptyState(catalogType);
  const itemNoun = resolveItemNoun(catalogType);
  const whatsappHref = buildWhatsAppLink(profile.contactPhone, profile.name);
  const directionsHref =
    location && location.latitude !== undefined && location.longitude !== undefined
      ? buildDirectionsUrl(location.latitude, location.longitude)
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
      {isOwner && (
        <Link
          href="/cuenta"
          aria-label="Cuenta"
          className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-lg backdrop-blur transition-colors hover:bg-background"
        >
          <Gear size={20} weight="bold" />
        </Link>
      )}

      <div className="relative h-64 w-full bg-border">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto remota del negocio, sin dominio de next/image configurado todavía
          <img src={heroPhoto.url} alt={profile.name ?? "Negocio"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <HeroFallbackIcon size={64} weight="duotone" className="text-text-muted" />
          </div>
        )}
        {/* Revertido a pedido explícito del usuario (sin RF asociado):
            la retroalimentación sobre el redediseño de navegación global
            (CLAUDE.md sección 54, punto 7) había unificado esto a un
            fondo oscuro translúcido para los dos estados, quitando el
            verde de marca — el usuario pidió después volver a la
            versión con color por estado, tal como estaba antes de esa
            auditoría. */}
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
        {location?.referenceAddress && (
          <p className="font-sans text-body-sm text-text-muted">{location.referenceAddress}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-2">
          {profile.ownDelivery && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-terracota/10 px-3 py-1 font-sans text-caption font-semibold text-terracota">
              <Moped size={16} weight="bold" />
              Hace domicilios propios
            </span>
          )}
          {profile.seatingAvailable && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-terracota/10 px-3 py-1 font-sans text-caption font-semibold text-terracota">
              <Chair size={16} weight="bold" />
              Tiene bancas/asientos
            </span>
          )}
          {profile.hygieneSelfDeclared && <HygieneBadge />}
          <AvailabilityConfirmedBadge confirmedAt={availabilityConfirmedAt} />
        </div>
        {profile.id && !isOwner && user && (
          <div className="mt-2">
            <AvailabilityRequestButton businessId={profile.id} onConfirmed={setAvailabilityConfirmedAt} />
          </div>
        )}
      </div>

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <BusinessStatusBanner businessId={profile.id} status={profile.status} />
        </div>
      )}

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <VendorAvailabilityRequestsPanel
            businessId={profile.id}
            onConfirmed={setAvailabilityConfirmedAt}
          />
        </div>
      )}

      {isOwner && !phoneVerified && profile.id && (
        <div className="px-5 pb-4">
          <PhoneVerificationPanel
            businessId={profile.id}
            contactPhone={profile.contactPhone ?? null}
            onVerified={() => setPhoneVerified(true)}
          />
        </div>
      )}

      {isOwner && profile.id && location && (
        <div className="px-5 pb-4">
          <LocationVisibilityToggle
            businessId={profile.id}
            initialShowExactLocation={Boolean(location.showExactLocation)}
          />
        </div>
      )}

      {isOwner && profile.id && location && location.type && (
        <div className="px-5 pb-4">
          <LocationPinEditor
            businessId={profile.id}
            location={{
              type: location.type,
              referenceAddress: location.referenceAddress,
              latitude: location.latitude ?? 0,
              longitude: location.longitude ?? 0,
              showExactLocation: Boolean(location.showExactLocation),
            }}
            onSaved={setLocation}
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
          <SeatingToggle
            businessId={profile.id}
            name={profile.name}
            description={profile.description ?? null}
            categoryId={profile.categoryId}
            contactPhone={profile.contactPhone ?? null}
            initialSeatingAvailable={Boolean(profile.seatingAvailable)}
          />
        </div>
      )}

      {isOwner && profile.id && profile.name != null && profile.categoryId != null && (
        <div className="px-5 pb-4">
          <MobilityToggle
            businessId={profile.id}
            name={profile.name}
            description={profile.description ?? null}
            categoryId={profile.categoryId}
            contactPhone={profile.contactPhone ?? null}
            initialMobility={profile.mobility ?? "itinerant"}
            onChange={setMobility}
          />
        </div>
      )}

      {/* Solo para un ambulante: compartir la ubicación en vivo (con la
          app abierta) y los puntos por hora (franjas del día). */}
      {isOwner && profile.id && mobility === "itinerant" && (
        <div className="flex flex-col gap-4 px-5 pb-4">
          <LiveLocationToggle businessId={profile.id} />
          <LocationSlotsEditor businessId={profile.id} />
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-title-2 font-semibold text-text">{catalogSectionLabel}</h2>
          {isOwner && (
            <button
              type="button"
              onClick={() => setProductForm({ mode: "create" })}
              className="flex items-center gap-1 font-sans text-body-sm font-semibold text-terracota"
            >
              <Plus size={16} weight="bold" />
              Agregar {itemNoun}
            </button>
          )}
        </div>
        {products.length === 0 && (
          <p className="font-sans text-body-sm text-text-muted">{catalogEmptyState}</p>
        )}
        {products.map((product) => (
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
            onEdit={(toEdit) => setProductForm({ mode: "edit", product: toEdit })}
            onDeleted={handleProductDeleted}
            offerTypeName={
              product.offerTypeId != null ? (offerTypeNameById.get(product.offerTypeId) ?? null) : null
            }
            onExpand={(expandedProduct) => {
              if (profile.id && expandedProduct.id) logProductViewEvent(profile.id, expandedProduct.id);
            }}
          />
        ))}
      </section>

      {productForm && (productForm.mode === "create" || productForm.mode === "edit") && (
        <ProductForm
          mode={productForm.mode}
          itemNoun={itemNoun}
          initialValues={
            productForm.mode === "edit"
              ? {
                  name: productForm.product.name ?? "",
                  price: productForm.product.price !== undefined ? String(productForm.product.price) : "",
                  description: productForm.product.description ?? "",
                  available: productForm.product.available !== false,
                  offerTypeId: productForm.product.offerTypeId ?? null,
                  validFrom: productForm.product.validFrom ?? null,
                  validUntil: productForm.product.validUntil ?? null,
                }
              : undefined
          }
          submitting={productFormSubmitting}
          error={productFormError}
          fieldErrors={productFormFieldErrors}
          onSubmit={handleProductFormSubmit}
          onCancel={closeProductForm}
        />
      )}

      {productForm && productForm.mode === "create-photo" && productForm.product.id && (
        <ProductPhotoStep
          productId={productForm.product.id}
          productName={productForm.product.name ?? itemNoun}
          currentPhoto={pendingProductPhoto}
          onPhotoChange={setPendingProductPhoto}
          onDone={finishProductCreation}
        />
      )}

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
        actions={[
          whatsappHref
            ? {
                icon: <WhatsappLogo size={32} weight="fill" />,
                label: "Contactar por WhatsApp",
                href: whatsappHref,
                onClick: () => {
                  if (profile.id) logContactClickEvent(profile.id);
                },
              }
            : null,
          directionsHref
            ? {
                icon: <NavigationArrow size={22} weight="fill" />,
                label: "Cómo llegar",
                href: directionsHref,
              }
            : null,
          // Hallazgo real (sin RF asociado, petición directa del
          // usuario): esta pantalla seguía montando la vieja
          // `BottomNavBar` (fija, horizontal) mientras el resto de la
          // app ya migró a `MainFloatingNav` — quedaba huérfana del
          // redediseño de navegación global. Se retira esa barra y, en
          // su lugar, se agrega "Volver al mapa" como tercera acción de
          // este mismo stack — siempre presente, sin depender de sesión
          // (a diferencia de WhatsApp/Cómo llegar, que dependen de que
          // el negocio tenga esos datos).
          {
            icon: <Compass size={22} weight="fill" />,
            label: "Volver al mapa",
            onClick: () => router.push("/mapa"),
          },
        ]}
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
