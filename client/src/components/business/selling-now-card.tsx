"use client";

import { Button } from "@/components/ui/button";
import { SEMANTIC_ICONS } from "@/lib/icons/semantic-icons";
import { formatConfirmedAgo } from "@/lib/availability/format-confirmed-at";
import { useSellingNow } from "@/lib/availability/use-selling-now";

// DI-06: el mismo ícono que ya significa "el vendedor confirmó que está vendiendo".
const ConfirmedSellingIcon = SEMANTIC_ICONS.confirmedSelling;
const EXPIRING_SOON_MINUTES = 10;

interface SellingNowCardProps {
  businessId: string;
  confirmedAt: string | null;
  onChange: (confirmedAt: string | null) => void;
}

/**
 * R5 — "Estoy vendiendo ahora" (docs/specs/r5-estoy-vendiendo.md, 6.1).
 * Tarjeta arriba del perfil del dueño: es la acción más frecuente del
 * vendedor. Sin aviso vigente ofrece avisar; con aviso vigente muestra
 * cuánto le queda y ofrece renovarlo o apagarlo. Apagar no pide
 * confirmación: es reversible (se puede volver a avisar al instante).
 */
export function SellingNowCard({ businessId, confirmedAt, onChange }: SellingNowCardProps) {
  const { active, minutesLeft, busy, error, notice, confirm, stop } = useSellingNow(
    businessId,
    confirmedAt,
    onChange,
  );
  const expiringSoon = active && minutesLeft <= EXPIRING_SOON_MINUTES;

  return (
    <section
      aria-label="Estoy vendiendo ahora"
      className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            active ? "bg-verde/10 text-verde" : "bg-terracota/10 text-terracota"
          }`}
        >
          <ConfirmedSellingIcon size={24} weight="fill" />
        </span>
        {active && confirmedAt ? (
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-body font-semibold text-text">Estás vendiendo ahora</p>
            <p className="font-sans text-body-sm text-text-muted">
              {formatConfirmedAgo(confirmedAt)} ·{" "}
              <span className={expiringSoon ? "font-semibold text-text" : undefined}>
                se vence en {minutesLeft} min
              </span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-body font-semibold text-text">¿Estás vendiendo ahora?</p>
            <p className="font-sans text-body-sm text-text-muted">
              Avísales a tus clientes. El aviso dura 60 minutos.
            </p>
          </div>
        )}
      </div>

      {active ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={confirm} loading={busy === "confirm"} disabled={busy !== null} className="flex-1">
            Sigo vendiendo
          </Button>
          <Button
            variant="secondary"
            onClick={stop}
            loading={busy === "stop"}
            disabled={busy !== null}
            className="flex-1"
          >
            Ya no estoy vendiendo
          </Button>
        </div>
      ) : (
        <Button onClick={confirm} loading={busy === "confirm"} disabled={busy !== null}>
          Estoy vendiendo ahora
        </Button>
      )}

      <div aria-live="polite">
        {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
        {!error && notice && <p className="font-sans text-body-sm text-text-muted">{notice}</p>}
      </div>
    </section>
  );
}

interface SellingNowSuggestionProps extends SellingNowCardProps {
  liveLocationOn: boolean;
}

/**
 * Spec DP-4: compartir la ubicación en vivo no cuenta como "estoy
 * vendiendo" (son dos datos y dos consentimientos distintos), pero al
 * encenderla se sugiere avisar también, con un toque.
 */
export function SellingNowSuggestion({ businessId, confirmedAt, onChange, liveLocationOn }: SellingNowSuggestionProps) {
  const { active, busy, error, confirm } = useSellingNow(businessId, confirmedAt, onChange);
  if (!liveLocationOn || active) return null;

  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-background px-4 py-3">
      <p className="font-sans text-body-sm text-text">
        Estás compartiendo tu ubicación en vivo. ¿Avisas también que estás vendiendo?
      </p>
      <Button onClick={confirm} loading={busy === "confirm"} className="w-fit">
        Estoy vendiendo ahora
      </Button>
      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}
    </div>
  );
}
