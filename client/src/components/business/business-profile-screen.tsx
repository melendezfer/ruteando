"use client";

import { useEffect, useState } from "react";
import { CookingPot, NavigationArrow, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { logBusinessViewEvent, logContactClickEvent, logProductViewEvent } from "@/lib/api/events";
import { useAuth } from "@/lib/auth/auth-context";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { ProductRow } from "@/components/business/product-row";
import { ReviewList } from "@/components/business/review-list";
import { PhoneVerificationPanel } from "@/components/business/phone-verification-panel";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];

interface BusinessProfileScreenProps {
  profile: BusinessProfile;
  categoryName: string | null;
}

/**
 * Perfil público de negocio (Épica F4, RF-012 a RF-014). Recibe el
 * perfil ya resuelto por el Server Component (src/app/negocios/[businessId]/page.tsx,
 * que también lo usa para generateMetadata) — no vuelve a pedirlo, para
 * no duplicar la llamada que ya hizo el render de servidor.
 */
export function BusinessProfileScreen({ profile, categoryName }: BusinessProfileScreenProps) {
  const { user } = useAuth();
  // Estado local aparte de `profile` (inmutable, viene del Server
  // Component) — así, al confirmar el código, el aviso desaparece de
  // inmediato sin depender de recargar la página o volver a pedir el
  // perfil completo solo por este campo.
  const [phoneVerified, setPhoneVerified] = useState(Boolean(profile.phoneVerified));

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

  const heroPhoto = profile.photos?.find((photo) => photo.type === "business") ?? null;
  const whatsappHref = buildWhatsAppLink(profile.contactPhone, profile.name);
  const directionsHref = profile.location
    ? `https://www.google.com/maps/dir/?api=1&destination=${profile.location.latitude},${profile.location.longitude}`
    : null;

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="relative h-64 w-full bg-border">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto remota del negocio, sin dominio de next/image configurado todavía
          <img src={heroPhoto.url} alt={profile.name ?? "Negocio"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CookingPot size={64} weight="duotone" className="text-text-muted" />
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
          {categoryName ?? "Comida callejera"}
          {profile.averageRating != null &&
            ` · ${profile.averageRating.toFixed(1)} ★ (${profile.reviewCount ?? 0} reseña${profile.reviewCount === 1 ? "" : "s"})`}
        </p>
        {profile.location?.referenceAddress && (
          <p className="font-sans text-body-sm text-text-muted">{profile.location.referenceAddress}</p>
        )}
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

      <section className="flex flex-col gap-3 px-5 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Menú</h2>
        {(profile.products?.length ?? 0) === 0 && (
          <p className="font-sans text-body-sm text-text-muted">Este negocio todavía no publicó su menú.</p>
        )}
        {profile.products?.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            photoUrl={
              profile.photos?.find((photo) => photo.type === "product" && photo.productId === product.id)?.url ??
              null
            }
            onExpand={(expandedProduct) => {
              if (profile.id && expandedProduct.id) logProductViewEvent(profile.id, expandedProduct.id);
            }}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3 px-5 py-4">
        <h2 className="font-heading text-title-2 font-semibold text-text">Reseñas</h2>
        {profile.id && <ReviewList businessId={profile.id} />}
      </section>

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
