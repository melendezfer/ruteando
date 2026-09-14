"use client";

import { useState, type MouseEvent } from "react";
import { Heart } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { useFavorites } from "@/lib/favorites/favorites-context";
import { logFavoriteAddedEvent } from "@/lib/api/events";

interface FavoriteButtonProps {
  businessId: string | null | undefined;
  ownerId: string | null | undefined;
  size?: number;
  className?: string;
}

/**
 * Corazón para agregar/quitar un negocio de favoritos (RF-017, Épica F8)
 * — reusado en business-profile-screen.tsx y business-card.tsx (así lo
 * heredan Inicio, Mapa y Favoritos, que ya reusan BusinessCard) para no
 * duplicar la lógica de sesión/optimistic update en cada pantalla.
 *
 * No se renderiza en dos casos, a propósito (pedido explícito del
 * usuario):
 * - Sin sesión activa: los tres endpoints de favoritos requieren
 *   autenticación (mismo criterio que LocationVisibilityToggle/
 *   OwnDeliveryToggle, que tampoco ofrecen su acción a un anónimo) — a
 *   diferencia de ReviewForm (que sí muestra un aviso "inicia sesión
 *   para calificar"), acá no se pidió ningún aviso equivalente.
 * - El propio dueño viendo su negocio: "favorito" no tiene sentido para
 *   quien ya es dueño.
 */
export function FavoriteButton({ businessId, ownerId, size = 22, className = "" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [pending, setPending] = useState(false);

  if (!user || !businessId) return null;
  if (ownerId && ownerId === user.id) return null;

  const active = isFavorite(businessId);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // stopPropagation: en business-card.tsx este botón vive junto a un
    // <button> hermano que expande/colapsa la tarjeta — sin esto, tocar
    // el corazón también dispararía ese toggle.
    event.preventDefault();
    event.stopPropagation();
    if (pending || !businessId) return;

    setPending(true);
    const wasFavorite = active;
    const ok = await toggleFavorite(businessId);
    setPending(false);

    if (ok && !wasFavorite) logFavoriteAddedEvent(businessId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Agregar a favoritos"}
      className={`flex shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${className}`}
    >
      <Heart
        size={size}
        weight={active ? "fill" : "regular"}
        className={active ? "text-terracota" : "text-text-muted"}
      />
    </button>
  );
}
