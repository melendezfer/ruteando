"use client";

import { useState } from "react";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
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
 * Favoritos ya no es una pestaña acá — nunca lo volvió a ser tras
 * promoverse a `/favoritos` (Épica F8); esa ruta a su vez desapareció
 * con el redediseño de navegación global (sin RF asociado, petición
 * directa del usuario, ver CLAUDE.md) — los favoritos se ven dentro del
 * banner del mapa o desde el ícono correspondiente de la navegación
 * flotante, nunca como una pantalla propia.
 *
 * El nombre del usuario y "Cerrar sesión" se mueven ACÁ (antes vivían en
 * `AppHeader`, que desapareció junto con `BottomNavBar` en el mismo
 * redediseño): en el resto de las pantallas principales ya no se
 * muestra el nombre de forma permanente — la única personalización por
 * nombre que queda es el placeholder del buscador ("¿Qué buscas,
 * {nombre}?"). Este componente ya se comparte entre `/perfil` (sin
 * negocio activo) y `/cuenta` (vendedor con negocio activo, ver CLAUDE.md
 * sección 43) — mover el logout acá cubre las dos rutas sin duplicar
 * nada.
 */
export function ProfileScreen({ user }: ProfileScreenProps) {
  const [tab, setTab] = useState<Tab>("reviews");
  const { logout } = useAuth();

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-title-1 font-bold text-text">{user.fullName}</h1>
          <p className="font-sans text-body-sm text-text-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Cerrar sesión"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <SignOut size={20} weight="bold" />
        </button>
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
