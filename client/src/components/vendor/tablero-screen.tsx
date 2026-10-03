"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Gear, Tag, Warning } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { CategoryIcon } from "@/components/ui/category-icon";
import { SellingNowCard } from "@/components/business/selling-now-card";
import { VendorAvailabilityRequestsPanel } from "@/components/business/vendor-availability-requests-panel";
import { BusinessStatusBanner } from "@/components/business/business-status-banner";
import { WeekStats } from "@/components/vendor/week-stats";
import { SoldOutList } from "@/components/vendor/sold-out-list";
import { formatHour, formatTodayHeader } from "@/lib/format/hour";
import { useCategoriesById } from "@/lib/categories/use-categories";
import type { TodayBusiness } from "@/lib/vendor/use-vendor-home-business";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];
type Product = components["schemas"]["Product"];

/** Estado de hoy en palabras ("Abierto hasta las 8:00 p. m."). */
function describirHoy(b: TodayBusiness): string {
  const { status, openTime, closeTime } = b.today;
  if (status === "now") return closeTime ? `Abierto hasta las ${formatHour(closeTime)}` : "Abierto ahora";
  if (status === "later" && openTime) return `Abre hoy a las ${formatHour(openTime)}`;
  return openTime ? "Ya cerró por hoy" : "No abre hoy";
}

function esHoyEnBogota(iso: string): boolean {
  const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
  return f(new Date(iso)) === f(new Date());
}

/**
 * Tablero del día (Perfil 2.0 C2, docs/specs/perfil-2.md §4): la página
 * principal del vendedor. Arriba el negocio de AHORA (o el elegido) con su
 * única acción principal, "Estoy vendiendo ahora" (R5); después los demás
 * negocios de hoy (DESPUÉS), "Tu semana", pendientes, "¿Qué se acabó?" (R3)
 * y atajos. El orden AHORA/DESPUÉS lo decide el servidor
 * (GET /users/me/businesses/today).
 */
export function TableroScreen({ businesses }: { businesses: TodayBusiness[] }) {
  const [selectedId, setSelectedId] = useState(businesses[0]?.id ?? null);
  const selected = businesses.find((b) => b.id === selectedId) ?? businesses[0];
  const others = businesses.filter((b) => b.id !== selected?.id);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const categoriesById = useCategoriesById();

  useEffect(() => {
    if (!selected?.id) return;
    let ignore = false;
    api.GET("/businesses/{businessId}", { params: { path: { businessId: selected.id } } }).then(({ data }) => {
      if (ignore) return;
      setProfile(data ?? null);
      setConfirmedAt(data?.availabilityConfirmedAt ?? null);
    });
    return () => {
      ignore = true;
    };
  }, [selected?.id]);

  const replaceProduct = useCallback((updated: Product) => {
    setProfile((p) =>
      p ? { ...p, products: (p.products ?? []).map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) } : p,
    );
  }, []);

  if (!selected?.id) return null;

  const products = profile?.products ?? [];
  const offersEndingToday = products.filter(
    (p) => p.validUntil && esHoyEnBogota(p.validUntil) && new Date(p.validUntil) > new Date(),
  );
  const variosNegocios = businesses.length > 1;
  const categoryType = categoriesById.get(selected.categoryId ?? -1)?.type;
  const unavailableLabel = categoryType === "services" ? "No disponible" : "Agotado";

  return (
    <div className="reserva-columna flex flex-1 flex-col gap-6 bg-background py-6 pl-5">
      <header className="flex flex-col gap-0.5">
        <p className="font-sans text-body-sm text-text-muted" suppressHydrationWarning>
          {formatTodayHeader()}
        </p>
        <h1 className="font-heading text-title-1 font-bold text-text">
          {variosNegocios ? "Mis negocios de hoy" : "Mi negocio hoy"}
        </h1>
      </header>

      {/* AHORA: el negocio de este momento (o el que el vendedor eligió). */}
      <section aria-labelledby="tablero-ahora" className="flex flex-col gap-3">
        {variosNegocios && (
          <h2 id="tablero-ahora" className="font-sans text-caption font-semibold uppercase tracking-wide text-text-muted">
            {selected.today.status === "now" ? "Ahora" : "Hoy"}
          </h2>
        )}
        <div className="flex flex-col gap-3 rounded-card border border-terracota-100 bg-surface p-4">
          <div className="flex items-start gap-3">
            <CategoryIcon categoryId={selected.categoryId} size="md" />
            <div className="flex min-w-0 flex-col">
              <p
                id={variosNegocios ? undefined : "tablero-ahora"}
                className="font-heading text-title-2 font-bold text-text"
              >
                {selected.name}
              </p>
              <p className="font-sans text-body-sm text-text-muted">{describirHoy(selected)}</p>
            </div>
          </div>
          <BusinessStatusBanner businessId={selected.id} status={selected.status} />
          {selected.status === "active" && (
            <SellingNowCard businessId={selected.id} confirmedAt={confirmedAt} onChange={setConfirmedAt} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/negocios/${selected.id}`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-input border border-terracota px-2 font-sans text-body-sm font-semibold text-terracota hover:bg-terracota-50"
            >
              <Eye size={16} weight="bold" />
              Ver como cliente
            </Link>
            <Link
              href={`/negocios/${selected.id}/ajustes`}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-input border border-terracota px-2 font-sans text-body-sm font-semibold text-terracota hover:bg-terracota-50"
            >
              <Gear size={16} weight="bold" />
              Ajustes
            </Link>
          </div>
        </div>
      </section>

      {/* DESPUÉS: los demás negocios de hoy, en orden de hora (los cerrados al final, atenuados). */}
      {others.length > 0 && (
        <section aria-labelledby="tablero-despues" className="flex flex-col gap-2">
          <h2 id="tablero-despues" className="font-sans text-caption font-semibold uppercase tracking-wide text-text-muted">
            Después
          </h2>
          <ul className="flex flex-col gap-2">
            {others.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(b.id ?? null)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-card border border-border bg-surface px-3 py-2 text-left ${
                    b.today.status === "closed" ? "opacity-60" : ""
                  }`}
                >
                  <CategoryIcon categoryId={b.categoryId} size="sm" />
                  <span className="min-w-0 flex-1 font-sans text-body font-medium text-text">{b.name}</span>
                  <span className="shrink-0 font-sans text-body-sm text-text-muted">
                    {b.today.status === "later" && b.today.openTime
                      ? formatHour(b.today.openTime)
                      : b.today.status === "now"
                        ? "Abierto"
                        : "Cerrado hoy"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="tablero-semana" className="flex flex-col gap-2">
        <h2 id="tablero-semana" className="font-heading text-title-2 font-bold text-text">
          Tu semana
        </h2>
        <WeekStats businessId={selected.id} />
      </section>

      <section aria-labelledby="tablero-pendientes" className="flex flex-col gap-2">
        <h2 id="tablero-pendientes" className="font-heading text-title-2 font-bold text-text">
          Pendientes
        </h2>
        <VendorAvailabilityRequestsPanel
          businessId={selected.id}
          onConfirmed={setConfirmedAt}
          onDeclined={() => setConfirmedAt(null)}
        />
        {profile && (!profile.location || !(profile.schedule?.length ?? 0)) && (
          <Link
            href={`/negocios/nuevo?negocio=${selected.id}`}
            className="flex min-h-11 items-center gap-2 rounded-card border border-terracota-100 bg-terracota-50 px-3 py-2 font-sans text-body-sm text-text"
          >
            <Warning size={18} weight="bold" className="shrink-0 text-terracota" />
            <span>
              Tu registro no está completo: {!profile.location ? "falta ubicar tu negocio." : "falta tu horario."}{" "}
              <span className="font-semibold text-terracota underline">Terminar registro</span>
            </span>
          </Link>
        )}
        {profile && !profile.phoneVerified && (
          <Link
            href={`/negocios/${selected.id}/ajustes`}
            className="flex min-h-11 items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 font-sans text-body-sm text-text"
          >
            <Warning size={18} weight="bold" className="shrink-0 text-ambar-texto" />
            <span>
              Verifica tu WhatsApp para aparecer en el mapa.{" "}
              <span className="font-semibold text-terracota underline">Verificar</span>
            </span>
          </Link>
        )}
        {offersEndingToday.map((p) => (
          <p
            key={p.id}
            className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 font-sans text-body-sm text-text"
          >
            <Tag size={18} weight="bold" className="shrink-0 text-terracota" />
            Tu oferta “{p.name}” se vence hoy.
          </p>
        ))}
        {profile &&
          profile.phoneVerified &&
          profile.location &&
          (profile.schedule?.length ?? 0) > 0 &&
          offersEndingToday.length === 0 && (
          <p className="font-sans text-body-sm text-text-muted">Sin avisos por ahora.</p>
        )}
      </section>

      <section aria-labelledby="tablero-agotado" className="flex flex-col gap-2">
        <h2 id="tablero-agotado" className="font-heading text-title-2 font-bold text-text">
          ¿Qué se acabó?
        </h2>
        {profile ? (
          <SoldOutList
            businessId={selected.id}
            products={products}
            onChange={replaceProduct}
            unavailableLabel={unavailableLabel}
          />
        ) : (
          <p className="font-sans text-body-sm text-text-muted">Cargando tu carta…</p>
        )}
      </section>

      <section aria-labelledby="tablero-atajos" className="flex flex-col gap-2">
        <h2 id="tablero-atajos" className="font-heading text-title-2 font-bold text-text">
          Atajos
        </h2>
        <Link
          href={`/negocios/${selected.id}?agregar=oferta`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-input bg-terracota px-3 font-sans text-body font-semibold text-white hover:bg-terracota-dark"
        >
          <Tag size={18} weight="bold" />
          Publicar oferta
        </Link>
      </section>
    </div>
  );
}
