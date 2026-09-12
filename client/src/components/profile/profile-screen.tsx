"use client";

import { useState } from "react";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { SettingsTab } from "@/components/profile/settings-tab";
import type { components } from "@/lib/api/schema";

type User = components["schemas"]["User"];

type Tab = "reviews" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "reviews", label: "Reseñas" },
  { value: "settings", label: "Configuración" },
];

interface ProfileScreenProps {
  user: User;
}

/**
 * Épica F6 — pestañas en el mismo lugar (CLAUDE.md sección 17): cambiar
 * de pestaña nunca navega a otra ruta, solo intercambia el contenido de
 * abajo. Reseñas es de solo lectura todavía a propósito — escribir
 * reseñas es la F7 (ya adelantada del lado del negocio, ver CLAUDE.md
 * sección 26; esta pestaña sigue siendo "mis reseñas", de solo lectura).
 *
 * Favoritos ya no es una pestaña acá — se promovió a su propio destino
 * de primer nivel (`/favoritos`) al construir `BottomNavBar` (CLAUDE.md
 * sección 27). El botón de cerrar sesión tampoco vive acá — `AppHeader`
 * (montado por `app/perfil/page.tsx`) es ahora el único lugar con esa
 * acción en las 4 pantallas principales, para no tener dos botones de
 * logout compitiendo en esta pantalla como pasaba antes.
 */
export function ProfileScreen({ user }: ProfileScreenProps) {
  const [tab, setTab] = useState<Tab>("reviews");

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-title-1 font-bold text-text">{user.fullName}</h1>
        <p className="font-sans text-body-sm text-text-muted">{user.email}</p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {TABS.map((option) => {
          const active = option.value === tab;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(option.value)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-sans text-body-sm font-medium transition-colors ${
                active
                  ? "bg-terracota text-white"
                  : "border border-border bg-surface text-text hover:bg-background"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {tab === "reviews" && <ReviewsTab />}
        {tab === "settings" && <SettingsTab user={user} />}
      </div>
    </div>
  );
}
