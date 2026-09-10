"use client";

import { useEffect, useState } from "react";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";

type Review = components["schemas"]["Review"];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

interface ReviewListProps {
  businessId: string;
}

/**
 * Lista de reseñas aprobadas (GET /businesses/{id}/reviews) — sin
 * formulario para crear una reseña todavía, eso es responsabilidad de la
 * Épica F7. El contrato de `Review` no trae nombre ni foto de quien la
 * escribió (solo `userId`), así que no se inventa un nombre de
 * "cliente anónimo" — se muestra la calificación, el comentario y la
 * fecha, nada más.
 */
export function ReviewList({ businessId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(async () => {
      const { data } = await api.GET("/businesses/{businessId}/reviews", {
        params: { path: { businessId }, query: { limit: 20 } },
      });
      if (!ignore) setReviews(data?.data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, [businessId]);

  if (reviews === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return <p className="font-sans text-body-sm text-text-muted">Todavía no hay reseñas para este negocio.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-card border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((position) => (
              <Star
                key={position}
                size={16}
                weight={position <= (review.rating ?? 0) ? "fill" : "regular"}
                className={position <= (review.rating ?? 0) ? "text-mostaza" : "text-border"}
              />
            ))}
          </div>
          {review.comment && <p className="mt-1 font-sans text-body-sm text-text">{review.comment}</p>}
          {review.createdAt && (
            <p className="mt-1 font-sans text-caption text-text-muted">
              {DATE_FORMATTER.format(new Date(review.createdAt))}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
