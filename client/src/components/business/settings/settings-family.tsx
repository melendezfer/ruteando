"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

interface SettingsFamilyProps {
  title: string;
  /** Una línea que resume lo que hay adentro, visible con la familia cerrada. */
  summary: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Una familia de "Ajustes del negocio" (Perfil 2.0, C3 —
 * docs/specs/perfil-2.md §5): cerrada muestra solo su título y una línea
 * de resumen; al tocarla se despliega en el mismo lugar (CLAUDE.md §17).
 * `button` con aria-expanded/aria-controls (spec §8).
 */
export function SettingsFamily({ title, summary, icon, defaultOpen = false, children }: SettingsFamilyProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className="rounded-card border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracota-50 text-terracota">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading text-body font-semibold text-text">{title}</span>
          <span className="truncate font-sans text-body-sm text-text-muted">{summary}</span>
        </span>
        <CaretDown
          size={18}
          weight="bold"
          className={`shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      {/* El contenido se monta solo abierto: el mapa (Leaflet) no mide bien su
          tamaño dentro de un bloque oculto, y así cada familia carga lo suyo
          recién cuando se necesita. */}
      <div id={panelId} hidden={!open}>
        {open && <div className="flex flex-col gap-4 border-t border-border px-4 py-4">{children}</div>}
      </div>
    </section>
  );
}
