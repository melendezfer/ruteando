"use client";

import { useEffect, useRef } from "react";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Acción que no se puede deshacer (borrar): el botón va en rojo suave. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * R4 (docs/integracion-ancla.md): hoja de confirmación única para las
 * acciones que NO se pueden deshacer. Reemplaza a `window.confirm` (que en
 * el celular se ve como un diálogo del sistema, sin la marca ni el idioma
 * de la app). Lo reversible no pide confirmación: se hace y se ofrece
 * "Deshacer" (UndoToast). Capa `--capa-modales` (R14).
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      data-confirm-sheet
      className="fixed inset-0 z-(--capa-modales) flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-sheet-title"
        aria-describedby="confirm-sheet-message"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-t-card bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-card"
      >
        <h2 id="confirm-sheet-title" className="font-heading text-title-2 font-bold text-text">
          {title}
        </h2>
        <p id="confirm-sheet-message" className="font-sans text-body text-text-muted">
          {message}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-12 rounded-input border border-terracota bg-surface px-3 font-sans text-body font-semibold text-terracota hover:bg-terracota-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-12 rounded-input px-3 font-sans text-body font-semibold disabled:opacity-60 ${
              destructive ? "bg-rojo-suave text-rojo-texto" : "bg-terracota text-white hover:bg-terracota-dark"
            }`}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
