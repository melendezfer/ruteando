"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastInput {
  message: string;
  /** Si viene, el aviso ofrece "Deshacer" (o `actionLabel`). */
  onUndo?: () => void;
  actionLabel?: string;
}

interface ToastState extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

/** Tiempo para alcanzar a deshacer (WCAG 2.2.1: suficiente para leer y tocar). */
const DURACION_MS = 7000;

/**
 * R4 (docs/integracion-ancla.md): UN solo aviso a la vez para toda la app,
 * con "Deshacer" para las acciones reversibles (marcar agotado, etc.). Un
 * aviso nuevo reemplaza al anterior. Abajo a la izquierda, sin pasar por la
 * franja de la columna de navegación (reserva-columna); capa `--capa-avisos`
 * (R14), visible también sobre una hoja del mapa.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const contador = useRef(0);

  const show = useCallback((input: ToastInput) => {
    contador.current += 1;
    setToast({ ...input, id: contador.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((actual) => (actual?.id === toast.id ? null : actual)), DURACION_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-(--capa-avisos) flex pb-[max(1rem,env(safe-area-inset-bottom))] pl-3"
        style={{ paddingRight: "var(--columna-franja)" }}
      >
        {toast && (
          <div
            data-undo-toast
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card bg-text px-4 py-2 font-sans text-body-sm text-white shadow-lg"
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.onUndo && (
              <button
                type="button"
                onClick={() => {
                  toast.onUndo?.();
                  setToast(null);
                }}
                className="min-h-11 shrink-0 rounded-input px-2 font-semibold text-terracota-100 underline"
              >
                {toast.actionLabel ?? "Deshacer"}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useUndoToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useUndoToast fuera de UndoToastProvider");
  return ctx.show;
}
