"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { FloatingActionStack } from "@/components/ui/floating-action-stack";
import { FavoritesTab } from "@/components/profile/favorites-tab";
import { ReviewsTab } from "@/components/profile/reviews-tab";
import { SettingsTab } from "@/components/profile/settings-tab";
import type { components } from "@/lib/api/schema";

type User = components["schemas"]["User"];

type Tab = "favorites" | "reviews" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "favorites", label: "Favoritos" },
  { value: "reviews", label: "Reseñas" },
  { value: "settings", label: "Configuración" },
];

interface ProfileScreenProps {
  user: User;
}

/**
 * Épica F6 — pestañas en el mismo lugar (CLAUDE.md sección 17): cambiar
 * de pestaña nunca navega a otra ruta, solo intercambia el contenido de
 * abajo. Favoritos y Reseñas son de solo lectura todavía a propósito —
 * marcar/desmarcar favoritos es la Épica F8, escribir reseñas es la F7;
 * adelantarlas acá habría sido construir sobre un contrato que esas
 * épicas todavía no definen del todo del lado del cliente.
 */
export function ProfileScreen({ user }: ProfileScreenProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("favorites");

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-1 flex-col gap-5 bg-background px-5 py-6 pb-28">
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
        {tab === "favorites" && <FavoritesTab />}
        {tab === "reviews" && <ReviewsTab />}
        {tab === "settings" && <SettingsTab user={user} />}
      </div>

      <FloatingActionStack
        primary={{
          icon: <SignOut size={26} weight="fill" />,
          label: "Cerrar sesión",
          onClick: handleLogout,
        }}
      />
    </div>
  );
}
