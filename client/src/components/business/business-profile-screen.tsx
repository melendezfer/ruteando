"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Chair,
  Gear,
  Moped,
  Plus,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { CategoryIcon } from "@/components/ui/category-icon";
import { formatRelativeTimeShort } from "@/lib/format/relative-time";
import { MOBILITY_ICONS, MOBILITY_LABELS, SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";
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
import { SellingNowCard } from "@/components/business/selling-now-card";
import { HygieneBadge } from "@/components/business/hygiene-badge";
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
import type { UploadedPhoto } from "@/lib/api/photos";
import { createProduct, updateProduct } from "@/lib/api/products";
import { api } from "@/lib/api/client";
import {
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

const LiveIcon = SEMANTIC_ICONS.liveLocation;

// A8 (fix/pulido-visual): insignias compactas y con texto corto para que
// fluyan varias por línea en el celular (a 320 px ocupaban una línea cada una).
const BADGE_CLASS = "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-sans text-caption font-semibold";
const ViewOnMapIcon = SEMANTIC_ICONS.viewOnMap;
const DirectionsIcon = SEMANTIC_ICONS.directions;


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
  const phoneVerified = Boolean(profile.phoneVerified);

  // Ajustar ubicación en el mapa (sin RF asociado — ver CLAUDE.md):
  // mismo criterio que phoneVerified arriba — así, al guardar una nueva
  // posición del pin (LocationPinEditor), "Cómo llegar" y la dirección
  // de referencia mostrada se actualizan de inmediato sin recargar.
  const location = profile.location ?? null;
  // Modalidad vigente (el interruptor la cambia sin recargar) — decide si
  // se muestran los paneles de ambulante.
  const mobility = profile.mobility ?? "itinerant";

  // "Vendiendo ahora" (Fase 2, sin RF asociado — ver CLAUDE.md sección
  // 11/37): mismo criterio que phoneVerified arriba — así, cuando el
  // vendedor confirma mientras el consumidor sigue mirando la pantalla
  // (AvailabilityRequestButton#onConfirmed), el badge aparece de
  // inmediato sin depender de recargar la página.
  // Ubicación en vivo encendida en esta pestaña (spec R5, DP-4): solo
  // para sugerir "¿avisas también que estás vendiendo?".
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
  const [heroPhoto] = useState<UploadedPhoto | null>(() => {
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
  const [offerTypeById, setOfferTypeById] = useState<Map<number, { name: string; icon: string | null }>>(new Map());
  useEffect(() => {
    let ignore = false;
    api.GET("/offer-types").then(({ data }) => {
      if (!ignore && data) {
        setOfferTypeById(new Map(data.map((t) => [t.id!, { name: t.name!, icon: t.icon ?? null }])));
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

  // Marca de modalidad — el MISMO ícono que la marca del pin del mapa
  // (lib/icons/semantic-icons.ts); antes el perfil y el mapa dibujaban el
  // carrito de dos formas distintas.
  const MobilityIcon = MOBILITY_ICONS[mobility];
  const catalogSectionLabel = resolveCatalogSectionLabel(catalogType);
  const catalogEmptyState = resolveCatalogEmptyState(catalogType);
  const itemNoun = resolveItemNoun(catalogType);
  const whatsappHref = buildWhatsAppLink(profile.contactPhone, profile.name);
  // "Cómo llegar" a donde está el negocio AHORA, con el mismo orden que
  // el mapa: en vivo > franja vigente > ubicación base. Antes apuntaba
  // siempre a la base, aunque el ambulante estuviera en otro sitio.
  const live = profile.liveLocation ?? null;
  const slot = profile.activeLocationSlot ?? null;
  const effective =
    live?.latitude != null && live.longitude != null
      ? { latitude: live.latitude, longitude: live.longitude }
      : slot?.latitude != null && slot.longitude != null
        ? { latitude: slot.latitude, longitude: slot.longitude }
        : location && location.latitude !== undefined && location.longitude !== undefined
          ? { latitude: location.latitude, longitude: location.longitude }
          : null;
  const directionsHref = effective ? buildDirectionsUrl(effective.latitude, effective.longitude) : null;

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
          href={`/negocios/${profile.id}/ajustes`}
          aria-label="Ajustes del negocio"
          className="fixed right-3 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-lg backdrop-blur transition-colors hover:bg-background"
        >
          <Gear size={20} weight="bold" />
        </Link>
      )}

      <div className="relative h-64 w-full bg-terracota-50">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto remota del negocio, sin dominio de next/image configurado todavía
          <img src={heroPhoto.url} alt={profile.name ?? "Negocio"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {/* Sin foto: el ícono y color guardados de la categoría, igual
                que en el pin, el banner y las tarjetas (antes: un ícono
                gris por tipo de catálogo, solo en este caso). */}
            <CategoryIcon categoryId={profile.categoryId} size="xl" />
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
          className={`absolute bottom-3 left-3 rounded-full px-3 py-1 font-sans text-caption font-semibold uppercase tracking-wide ${
            profile.isOpenNow ? "bg-verde-suave text-verde-texto" : "bg-ambar-suave text-ambar-texto"
          }`}
        >
          {profile.isOpenNow ? "Abierto ahora" : "Cerrado ahora"}
        </span>
      </div>

      <div className="flex flex-col gap-1 px-5 py-4">
        <h1 className="font-heading text-title-1 font-bold text-text">{profile.name}</h1>
        <p className="flex flex-wrap items-center gap-1.5 font-sans text-body-sm text-text-muted">
          <CategoryIcon categoryId={profile.categoryId} size="sm" />
          {categoryName ?? "Comercio informal"}
          {profile.averageRating != null &&
            ` · ${profile.averageRating.toFixed(1)} ★ (${profile.reviewCount ?? 0} reseña${profile.reviewCount === 1 ? "" : "s"})`}
        </p>
        {/* Dónde está AHORA, si no es su punto de siempre (en vivo, o en
            una de sus franjas del día). */}
        {live ? (
          // suppressHydrationWarning: "hace X" depende del reloj (ver product-row.tsx).
          <p
            className="inline-flex items-center gap-1.5 font-sans text-body-sm font-medium text-terracota"
            suppressHydrationWarning
          >
            <LiveIcon size={16} weight="bold" />
            En vivo · ubicación actualizada {live.updatedAt ? formatRelativeTimeShort(live.updatedAt) : "hace instantes"}
          </p>
        ) : slot ? (
          <p className="font-sans text-body-sm text-text-muted">
            Ahora ({slot.startTime}–{slot.endTime}): {slot.referenceAddress ?? "en otro punto del barrio"}
          </p>
        ) : (
          location?.referenceAddress && (
            <p className="font-sans text-body-sm text-text-muted">{location.referenceAddress}</p>
          )
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className={`${BADGE_CLASS} bg-background text-text`}>
            <MobilityIcon size={14} weight="bold" />
            {MOBILITY_LABELS[mobility]}
          </span>
          {profile.ownDelivery && (
            <span aria-label="Hace domicilios propios" className={`${BADGE_CLASS} bg-terracota-50 text-terracota`}>
              <Moped size={14} weight="bold" />
              Domicilios
            </span>
          )}
          {profile.seatingAvailable && (
            <span aria-label="Tiene bancas o asientos" className={`${BADGE_CLASS} bg-terracota-50 text-terracota`}>
              <Chair size={14} weight="bold" />
              Bancas
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

      {/* Perfil 2.0, C3: los ajustes ya no se apilan acá (antes ~12
          tarjetas); viven en su propia pantalla, por familias. */}
      {isOwner && profile.id && (
        <div className="flex items-center justify-between gap-3 px-5 pb-4">
          <p className="font-sans text-body-sm text-text-muted">Así ven tu negocio tus clientes.</p>
          <Link
            href={`/negocios/${profile.id}/ajustes`}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-input border border-terracota px-3 font-sans text-body-sm font-semibold text-terracota hover:bg-terracota-50"
          >
            <Gear size={18} weight="bold" />
            Ajustes del negocio
          </Link>
        </div>
      )}

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <BusinessStatusBanner businessId={profile.id} status={profile.status} />
        </div>
      )}

      {/* R5 — "Estoy vendiendo ahora" (docs/specs/r5-estoy-vendiendo.md):
          solo con el negocio activo; el banner de estado de arriba ya
          explica por qué no, si no lo está. */}
      {isOwner && profile.id && profile.status === "active" && (
        <div className="px-5 pb-4">
          <SellingNowCard
            businessId={profile.id}
            confirmedAt={availabilityConfirmedAt}
            onChange={setAvailabilityConfirmedAt}
          />
        </div>
      )}

      {isOwner && profile.id && (
        <div className="px-5 pb-4">
          <VendorAvailabilityRequestsPanel
            businessId={profile.id}
            onConfirmed={setAvailabilityConfirmedAt}
            onDeclined={() => setAvailabilityConfirmedAt(null)}
          />
        </div>
      )}

      {isOwner && !phoneVerified && profile.id && (
        <div className="px-5 pb-4">
          <Link
            href={`/negocios/${profile.id}/ajustes`}
            className="flex items-center justify-between gap-3 rounded-card border border-ambar/40 bg-ambar-suave px-4 py-3 font-sans text-body-sm text-ambar-texto"
          >
            <span>
              <span className="font-semibold">Falta verificar tu teléfono.</span> Hasta entonces tu negocio no aparece
              en el mapa.
            </span>
            <span className="shrink-0 font-semibold underline">Verificar</span>
          </Link>
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
              product.offerTypeId != null ? (offerTypeById.get(product.offerTypeId)?.name ?? null) : null
            }
            unavailableLabel={catalogType === "services" ? "No disponible" : "Agotado"}
            offerTypeIcon={
              product.offerTypeId != null ? (offerTypeById.get(product.offerTypeId)?.icon ?? null) : null
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

      {/* A2 (fix/pulido-visual): WhatsApp y Cómo llegar son acciones del
          cliente — el dueño no se escribe ni se busca a sí mismo, así que en
          su propio negocio solo queda "Volver al mapa". */}
      <FloatingActionStack
        actions={[
          whatsappHref && !isOwner
            ? {
                icon: <WhatsappLogo size={32} weight="fill" />,
                label: "Contactar por WhatsApp",
                shortLabel: "WhatsApp",
                href: whatsappHref,
                onClick: () => {
                  if (profile.id) logContactClickEvent(profile.id);
                },
              }
            : null,
          directionsHref && !isOwner
            ? {
                icon: <DirectionsIcon size={22} weight="fill" />,
                label: "Cómo llegar",
                shortLabel: "Llegar",
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
            icon: <ViewOnMapIcon size={22} weight="fill" />,
            label: "Volver al mapa",
            shortLabel: "Mapa",
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
