"use client";

import { ANCLA_HABILITADA, guardarModo, useModoAncla, type ModoAncla } from "@/lib/ancla/ancla-prefs";

const OPCIONES: { valor: ModoAncla; titulo: string; detalle: string }[] = [
  {
    valor: "completo",
    titulo: "Completo",
    detalle: "Menú con un gesto del pulgar, mover el mapa y elegir negocios sin soltar.",
  },
  { valor: "solo-menu", titulo: "Solo menú", detalle: "Menú con un gesto del pulgar, sin mover el mapa con él." },
  { valor: "apagado", titulo: "Apagado", detalle: "Los botones de siempre, al costado derecho." },
];

/**
 * Cuenta → Configuración (etapa I1, docs/integracion-ancla.md §0.2): los tres
 * modos del botón-ancla. Se guarda en este dispositivo. Sin la bandera
 * NEXT_PUBLIC_ANCLA no aparece.
 */
export function AjusteModoAncla() {
  const modo = useModoAncla();
  if (!ANCLA_HABILITADA) return null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
      <h2 id="ajuste-ancla" className="font-heading text-title-2 font-semibold text-text">
        Botón para una mano
      </h2>
      <p className="font-sans text-body-sm text-text-muted">
        Un solo botón que abre las opciones con un gesto del pulgar. Se guarda en este celular.
      </p>
      <div role="radiogroup" aria-labelledby="ajuste-ancla" className="flex flex-col gap-2">
        {OPCIONES.map((o) => (
          <label
            key={o.valor}
            className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-input border px-3 py-2 ${
              modo === o.valor ? "border-terracota bg-terracota-50" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="modo-ancla"
              value={o.valor}
              checked={modo === o.valor}
              onChange={() => guardarModo(o.valor)}
              className="mt-1 h-4 w-4 accent-terracota"
            />
            <span className="flex flex-col">
              <span className="font-sans text-body font-semibold text-text">{o.titulo}</span>
              <span className="font-sans text-body-sm text-text-muted">{o.detalle}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
