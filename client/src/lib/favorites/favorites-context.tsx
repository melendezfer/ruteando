"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";

// Mismo límite que favorites-screen.tsx (FAVORITES_LIMIT) — sin
// paginación real, razonable para la cantidad de favoritos que alguien
// acumula en la práctica (Documento 08, "sin scroll infinito"). Es
// también el máximo que acepta GET /users/me/favorites (`limit`, ver
// favoritos.validators.js).
const FAVORITES_FETCH_LIMIT = 50;

interface FavoritesContextValue {
  /**
   * `false` hasta que el primer GET /users/me/favorites resuelve (o el
   * usuario no está autenticado). favorites-screen.tsx lo usa para no
   * filtrar su propia lista recién fetcheada contra un Set todavía
   * vacío — evitaría un parpadeo real: mostrar la lista completa un
   * instante y luego "vaciarla" en falso solo porque este Set no había
   * cargado todavía.
   */
  isLoaded: boolean;
  isFavorite: (businessId: string | null | undefined) => boolean;
  /** Devuelve `true` si el cambio se confirmó contra el backend. */
  toggleFavorite: (businessId: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

/**
 * Épica F8 (RF-017): estado compartido de "cuáles negocios son favoritos
 * del usuario actual" — un solo GET /users/me/favorites (al iniciar
 * sesión, o al montar si ya había una) puebla un Set de ids en memoria,
 * para que el corazón de BusinessCard (Inicio/Mapa/Favoritos) y de
 * business-profile-screen.tsx no dependan cada uno de su propia llamada
 * ni disparen un GET aparte por cada tarjeta (evita N+1).
 *
 * toggleFavorite actualiza el Set de inmediato (optimistic update,
 * pedido explícito del usuario) antes de que POST/DELETE
 * /businesses/{businessId}/favorite confirme, y lo revierte si la
 * llamada falla. FavoritesScreen (la lista de /favoritos) también lee
 * este mismo Set para filtrar los negocios que ya trajo — así que
 * desmarcar un favorito, desde cualquier pantalla, hace desaparecer esa
 * tarjeta de /favoritos sin depender de volver a navegar para refrescar.
 *
 * Nunca se puebla para un usuario anónimo — los tres endpoints de
 * favoritos requieren autenticación, y FavoriteButton (favorite-button.tsx)
 * ya no se renderiza sin sesión, así que esto solo importa mientras
 * `status === "authenticated"`.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      // Fuera de la fase síncrona del efecto (mismo patrón ya usado en
      // home-screen.tsx/business-card.tsx/location-step.tsx para esta
      // misma regla de lint, react-hooks/set-state-in-effect).
      Promise.resolve().then(() => {
        setFavoriteIds(new Set());
        setIsLoaded(false);
      });
      return;
    }

    let ignore = false;
    api
      .GET("/users/me/favorites", { params: { query: { limit: FAVORITES_FETCH_LIMIT } } })
      .then(({ data }) => {
        if (ignore) return;
        const ids = (data?.data ?? [])
          .map((business) => business.id)
          .filter((id): id is string => Boolean(id));
        setFavoriteIds(new Set(ids));
        setIsLoaded(true);
      });
    return () => {
      ignore = true;
    };
  }, [status]);

  const isFavorite = useCallback(
    (businessId: string | null | undefined) => Boolean(businessId && favoriteIds.has(businessId)),
    [favoriteIds],
  );

  const toggleFavorite = useCallback(
    async (businessId: string): Promise<boolean> => {
      const wasFavorite = favoriteIds.has(businessId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(businessId);
        else next.add(businessId);
        return next;
      });

      const { response } = wasFavorite
        ? await api.DELETE("/businesses/{businessId}/favorite", { params: { path: { businessId } } })
        : await api.POST("/businesses/{businessId}/favorite", { params: { path: { businessId } } });

      if (!response.ok) {
        // El backend no confirmó el cambio — revertir el optimistic update.
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(businessId);
          else next.delete(businessId);
          return next;
        });
        return false;
      }

      return true;
    },
    [favoriteIds],
  );

  return (
    <FavoritesContext.Provider value={{ isLoaded, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites debe usarse dentro de <FavoritesProvider>");
  return context;
}
