"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  IdentificationCard,
  MapPin,
  ShieldCheck,
  Storefront,
  Toolbox,
  UserCircle,
} from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useCategoriesById } from "@/lib/categories/use-categories";
import { MOBILITY_LABELS } from "@/lib/icons/semantic-icons";
import { pickLatestPhoto } from "@/lib/photos/pick-latest-photo";
import { uploadBusinessPhoto, deletePhoto, type UploadedPhoto } from "@/lib/api/photos";
import { getPhotoDeleteErrorMessage, getPhotoUploadErrorMessage } from "@/lib/api/error-messages";
import { Skeleton } from "@/components/discovery/skeleton";
import { SettingsFamily } from "@/components/business/settings/settings-family";
import { IdentitySettings } from "@/components/business/settings/identity-settings";
import { ContactPhoneSettings } from "@/components/business/settings/contact-phone-settings";
import { ScheduleSettings } from "@/components/business/settings/schedule-settings";
import { DAYS, scheduleFromRows, type WeekSchedule } from "@/components/business/registration/schedule-step";
import { PhotoUploadControl } from "@/components/business/photo-upload-control";
import { OwnDeliveryToggle } from "@/components/business/own-delivery-toggle";
import { SeatingToggle } from "@/components/business/seating-toggle";
import { MobilityToggle } from "@/components/business/mobility-toggle";
import { LocationVisibilityToggle } from "@/components/business/location-visibility-toggle";
import { LiveLocationToggle } from "@/components/business/live-location-toggle";
import { SellingNowSuggestion } from "@/components/business/selling-now-card";
import { LocationSlotsEditor } from "@/components/business/location-slots-editor";
import { HygieneBadgeToggle } from "@/components/business/hygiene-badge-toggle";
import { PhoneVerificationPanel } from "@/components/business/phone-verification-panel";
import { BusinessQrCode } from "@/components/business/business-qr-code";
import { BusinessFeedbackPanel } from "@/components/business/business-feedback-panel";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];
type Business = components["schemas"]["Business"];
type Location = components["schemas"]["Location"];
type Mobility = NonNullable<Business["mobility"]>;
type Day = components["schemas"]["ScheduleDay"]["day"];

// Leaflet necesita el navegador (mismo motivo que en business-profile-screen.tsx).
const LocationPinEditor = dynamic(
  () => import("@/components/business/location-pin-editor").then((mod) => mod.LocationPinEditor),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-card" /> },
);

/** Lo que la pantalla necesita saber del negocio y va cambiando al guardar. */
interface BusinessState {
  name: string;
  description: string | null;
  categoryId: number;
  contactPhone: string | null;
  phoneVerified: boolean;
  ownDelivery: boolean;
  seatingAvailable: boolean;
  hygieneSelfDeclared: boolean;
  mobility: Mobility;
  status: Business["status"];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "ready"; profile: BusinessProfile };

/**
 * "Ajustes del negocio" (Perfil 2.0, C3 — docs/specs/perfil-2.md §5):
 * todo lo que antes estaba apilado debajo del perfil del dueño (~12
 * tarjetas), agrupado en seis familias plegables con una línea de
 * resumen. Los controles que ya existían se reusan sin cambiar su lógica;
 * lo nuevo es editar identidad, horario, WhatsApp y la referencia.
 *
 * El perfil se pide acá, en el navegador (no en un Server Component): así
 * viaja el token del dueño y el backend devuelve su ubicación EXACTA
 * (CLAUDE.md §22), no la aproximada que ve el público.
 */
export function BusinessSettingsScreen({ businessId }: { businessId: string }) {
  const { user } = useAuth();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let ignore = false;
    api
      .GET("/businesses/{businessId}", { params: { path: { businessId } } })
      .then(({ data, response }) => {
        if (ignore) return;
        if (!response.ok || !data) setLoad({ kind: "not-found" });
        else if (data.ownerId !== user?.id) setLoad({ kind: "forbidden" });
        else setLoad({ kind: "ready", profile: data });
      });
    return () => {
      ignore = true;
    };
  }, [businessId, user?.id]);

  if (load.kind === "loading") {
    return (
      <div className="flex flex-col gap-3 px-5 py-6">
        <Skeleton className="h-8 w-2/3" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-card" />
        ))}
      </div>
    );
  }
  if (load.kind !== "ready") {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="font-sans text-body text-text">
          {load.kind === "forbidden"
            ? "Solo el dueño del negocio puede cambiar sus ajustes."
            : "No encontramos este negocio."}
        </p>
        <Link href={`/negocios/${businessId}`} className="font-sans text-body font-semibold text-terracota underline">
          Volver al negocio
        </Link>
      </div>
    );
  }
  return <SettingsContent profile={load.profile} />;
}

function SettingsContent({ profile }: { profile: BusinessProfile }) {
  const businessId = profile.id!;
  const categoriesById = useCategoriesById();

  const [business, setBusiness] = useState<BusinessState>({
    name: profile.name ?? "",
    description: profile.description ?? null,
    categoryId: profile.categoryId!,
    contactPhone: profile.contactPhone ?? null,
    phoneVerified: Boolean(profile.phoneVerified),
    ownDelivery: Boolean(profile.ownDelivery),
    seatingAvailable: Boolean(profile.seatingAvailable),
    hygieneSelfDeclared: Boolean(profile.hygieneSelfDeclared),
    mobility: profile.mobility ?? "itinerant",
    status: profile.status,
  });
  const [location, setLocation] = useState<Location | null>(profile.location ?? null);
  const [heroPhoto, setHeroPhoto] = useState<UploadedPhoto | null>(() => {
    const photo = pickLatestPhoto(profile.photos, (p) => p.type === "business");
    return photo?.id && photo.url ? { id: photo.id, url: photo.url } : null;
  });
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [availabilityConfirmedAt, setAvailabilityConfirmedAt] = useState<string | null>(
    profile.availabilityConfirmedAt ?? null,
  );
  const [liveLocationOn, setLiveLocationOn] = useState(false);

  useEffect(() => {
    let ignore = false;
    api.GET("/businesses/{businessId}/schedule", { params: { path: { businessId } } }).then(({ data }) => {
      if (!ignore) setSchedule(scheduleFromRows(data ?? []));
    });
    return () => {
      ignore = true;
    };
  }, [businessId]);

  function applyBusiness(saved: Business) {
    setBusiness((prev) => ({
      ...prev,
      name: saved.name ?? prev.name,
      description: saved.description ?? null,
      categoryId: saved.categoryId ?? prev.categoryId,
      contactPhone: saved.contactPhone ?? null,
      phoneVerified: Boolean(saved.phoneVerified),
    }));
  }

  // Props que todo interruptor que usa PATCH /businesses/{id} necesita
  // mandar para no borrar el resto: SIEMPRE los valores vigentes, no los
  // de cuando se abrió la pantalla (si no, cambiar el nombre y después un
  // interruptor devolvería el nombre viejo).
  const patchBase = {
    businessId,
    name: business.name,
    description: business.description,
    categoryId: business.categoryId,
    contactPhone: business.contactPhone,
  };

  const categoryName = categoriesById.get(business.categoryId)?.name ?? "Sin categoría";
  const isItinerant = business.mobility === "itinerant";

  return (
    <div className="flex flex-col gap-3 px-5 pb-10 pt-4">
      <header className="flex items-center gap-3 pb-2">
        <Link
          href={`/negocios/${businessId}`}
          aria-label="Volver a mi negocio"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text"
        >
          <ArrowLeft size={20} weight="bold" />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-heading text-title-1 font-bold text-text">Ajustes del negocio</h1>
          <p className="truncate font-sans text-body-sm text-text-muted">{business.name}</p>
        </div>
      </header>

      <SettingsFamily
        title="Identidad"
        summary={`${business.name} · ${categoryName}`}
        icon={<IdentificationCard size={20} weight="bold" />}
      >
        <IdentitySettings {...patchBase} onSaved={applyBusiness} />
        <div className="flex flex-col gap-1.5">
          <PhotoUploadControl
            id={`business-photo-${businessId}`}
            label="Foto principal"
            currentPhoto={heroPhoto}
            uploadPhoto={(file) => uploadBusinessPhoto(businessId, file)}
            deletePhoto={deletePhoto}
            onPhotoChange={setHeroPhoto}
            uploadErrorMessage={getPhotoUploadErrorMessage}
            deleteErrorMessage={getPhotoDeleteErrorMessage}
          />
          <p className="font-sans text-body-sm text-text-muted">
            Consejo: de día, de frente y que se vea lo que vendes.
          </p>
        </div>
      </SettingsFamily>

      <SettingsFamily
        title="Cómo comprar"
        summary={buyingSummary(business)}
        icon={<Storefront size={20} weight="bold" />}
      >
        <ContactPhoneSettings {...patchBase} phoneVerified={business.phoneVerified} onSaved={applyBusiness} />
        <OwnDeliveryToggle
          {...patchBase}
          initialOwnDelivery={business.ownDelivery}
          onChange={(ownDelivery) => setBusiness((prev) => ({ ...prev, ownDelivery }))}
        />
        <SeatingToggle
          {...patchBase}
          initialSeatingAvailable={business.seatingAvailable}
          onChange={(seatingAvailable) => setBusiness((prev) => ({ ...prev, seatingAvailable }))}
        />
      </SettingsFamily>

      <SettingsFamily
        title="Ubicación"
        summary={`${MOBILITY_LABELS[business.mobility]} · ${location?.referenceAddress || "sin referencia"}`}
        icon={<MapPin size={20} weight="bold" />}
      >
        <MobilityToggle
          {...patchBase}
          initialMobility={business.mobility}
          onChange={(mobility) => setBusiness((prev) => ({ ...prev, mobility }))}
        />
        {location && location.type && (
          <LocationPinEditor
            businessId={businessId}
            location={{
              type: location.type,
              referenceAddress: location.referenceAddress,
              latitude: location.latitude ?? 0,
              longitude: location.longitude ?? 0,
              showExactLocation: Boolean(location.showExactLocation),
            }}
            onSaved={setLocation}
          />
        )}
        {location && (
          <LocationVisibilityToggle
            businessId={businessId}
            initialShowExactLocation={Boolean(location.showExactLocation)}
            onChange={(showExactLocation) => setLocation((prev) => (prev ? { ...prev, showExactLocation } : prev))}
          />
        )}
        {isItinerant && (
          <>
            <LocationSlotsEditor businessId={businessId} />
            <LiveLocationToggle businessId={businessId} onChange={setLiveLocationOn} />
            {business.status === "active" && (
              <SellingNowSuggestion
                businessId={businessId}
                confirmedAt={availabilityConfirmedAt}
                onChange={setAvailabilityConfirmedAt}
                liveLocationOn={liveLocationOn}
              />
            )}
          </>
        )}
      </SettingsFamily>

      <SettingsFamily
        title="Horario"
        summary={schedule ? scheduleSummary(schedule) : "Cargando…"}
        icon={<Clock size={20} weight="bold" />}
      >
        {schedule ? (
          <ScheduleSettings businessId={businessId} schedule={schedule} onSaved={setSchedule} />
        ) : (
          <Skeleton className="h-40 w-full rounded-card" />
        )}
      </SettingsFamily>

      <SettingsFamily
        title="Confianza"
        summary={[
          business.phoneVerified ? "Teléfono verificado" : "Falta verificar el teléfono",
          business.hygieneSelfDeclared ? "Higiene autodeclarada" : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        icon={<ShieldCheck size={20} weight="bold" />}
        defaultOpen={!business.phoneVerified}
      >
        {business.phoneVerified ? (
          <p className="rounded-input bg-verde-suave px-3 py-2 font-sans text-body-sm text-verde-texto">
            Tu teléfono {business.contactPhone} está verificado.
          </p>
        ) : (
          <PhoneVerificationPanel
            businessId={businessId}
            contactPhone={business.contactPhone}
            onVerified={() => setBusiness((prev) => ({ ...prev, phoneVerified: true }))}
          />
        )}
        <HygieneBadgeToggle
          {...patchBase}
          initialHygieneSelfDeclared={business.hygieneSelfDeclared}
          onChange={(hygieneSelfDeclared) => setBusiness((prev) => ({ ...prev, hygieneSelfDeclared }))}
        />
      </SettingsFamily>

      <SettingsFamily
        title="Herramientas"
        summary="Código QR · Ideas de tus clientes"
        icon={<Toolbox size={20} weight="bold" />}
      >
        <BusinessQrCode businessId={businessId} businessName={business.name} />
        <BusinessFeedbackPanel businessId={businessId} />
      </SettingsFamily>

      <Link
        href="/cuenta"
        className="mt-2 flex min-h-14 items-center gap-3 rounded-card border border-border bg-surface px-4 py-3"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-text">
          <UserCircle size={20} weight="bold" />
        </span>
        <span className="flex flex-col">
          <span className="font-heading text-body font-semibold text-text">Mi cuenta</span>
          <span className="font-sans text-body-sm text-text-muted">Datos personales y contraseña</span>
        </span>
      </Link>
    </div>
  );
}

function buyingSummary(business: BusinessState): string {
  const parts = [business.contactPhone ? `WhatsApp ${business.contactPhone}` : "Sin WhatsApp"];
  parts.push(business.ownDelivery ? "Domicilios" : "Sin domicilios");
  if (business.seatingAvailable) parts.push("Bancas");
  return parts.join(" · ");
}

/** "Hoy 08:00–18:00 · abre 6 días" / "Cerrado hoy · abre 5 días". */
function scheduleSummary(schedule: WeekSchedule): string {
  const openDays = DAYS.filter(({ value }) => !schedule[value].closed).length;
  if (openDays === 0) return "Sin horario";
  const today = schedule[todayInBogota()];
  const todayText = today.closed ? "Cerrado hoy" : `Hoy ${today.openTime}–${today.closeTime}`;
  return `${todayText} · abre ${openDays} día${openDays === 1 ? "" : "s"}`;
}

function todayInBogota(): Day {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Bogota" })
    .format(new Date())
    .toLowerCase();
  return weekday as Day;
}
