"use client";

import { useState } from "react";
import { Info, ShieldCheck, X } from "@phosphor-icons/react/dist/ssr";
import { HYGIENE_BADGE_LABEL, HYGIENE_DISCLAIMER_BODY, HYGIENE_DISCLAIMER_TITLE } from "@/lib/hygiene/hygiene";

interface HygieneBadgeProps {
  className?: string;
}

/**
 * Insignia pública del sello de higiene autodeclarada — visible para
 * cualquiera que vea el perfil del negocio cuando
 * BusinessProfile.hygieneSelfDeclared es true (ver CLAUDE.md). El texto
 * corto de la insignia nunca aparece solo: tocarla siempre abre la
 * aclaración completa (HYGIENE_DISCLAIMER_BODY) — "es una declaración
 * voluntaria del vendedor, RUTEANDO no la verifica" — nunca un texto
 * que sugiera una certificación oficial.
 */
export function HygieneBadge({ className = "" }: HygieneBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${HYGIENE_BADGE_LABEL} — no es una certificación oficial, toca para ver la aclaración`}
        className={`inline-flex w-fit items-center gap-1.5 rounded-full bg-verde/10 px-3 py-1 font-sans text-caption font-semibold text-verde ${className}`}
      >
        <ShieldCheck size={16} weight="bold" />
        {HYGIENE_BADGE_LABEL}
        <Info size={14} weight="bold" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hygiene-badge-modal-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-3 rounded-t-card bg-surface p-6 shadow-xl sm:rounded-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="hygiene-badge-modal-title" className="font-heading text-title-2 font-semibold text-text">
                {HYGIENE_DISCLAIMER_TITLE}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-text-muted"
              >
                <X size={20} />
              </button>
            </div>
            {HYGIENE_DISCLAIMER_BODY.map((paragraph, index) => (
              <p
                key={paragraph}
                className={`font-sans text-body-sm ${index === 0 ? "text-text" : "font-medium text-text-muted"}`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
