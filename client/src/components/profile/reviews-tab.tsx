"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { Skeleton } from "@/components/discovery/skeleton";
import { REVIEW_TAG_LABELS } from "@/lib/reviews/review-tags";

type UserReview = components["schemas"]["UserReview"];
type ModerationStatus = NonNullable<UserReview["moderationStatus"]>;

const REVIEWS_LIMIT = 50;
const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

const STATUS_BADGE: Record<ModerationStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente de revisión", className: "bg-ambar/20 text-ambar" },
  approved: { label: "Aprobada", className: "bg-verde/15 text-verde" },
  rejected: { label: "Rechazada", className: "bg-rojo/15 text-rojo" },
};

/**
 * GET /users/me/reviews (Épica F6, ruta nueva agregada junto con esta
 * pantalla — no existía ninguna forma de listar "mis reseñas", ver
 * openapi.yaml). Sin botón de editar/borrar todavía: esta pestaña es de
 * solo lectura a propósito (escribir reseñas es la Épica F7). A
 * diferencia de ReviewList (por negocio, público, solo aprobadas), acá
 * se muestran también las propias reseñas pendientes o rechazadas — el
 * autor es el único que puede verlas fuera del panel de moderación.
 */
export function ReviewsTab() {
  const [reviews, setReviews] = useState<UserReview[] | null>(null);

  useEffect(() => {
    let ignore = false;
    api.GET("/users/me/reviews", { params: { query: { limit: REVIEWS_LIMIT } } }).then(({ data }) => {
      if (!ignore) setReviews(data?.data ?? []);
    });
    return () => {
      ignore = true;
    };
  }, []);

  if (reviews === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-10 text-center">
        <p className="font-sans text-body text-text">Todavía no has escrito ninguna reseña.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => {
        const badge = review.moderationStatus ? STATUS_BADGE[review.moderationStatus] : null;
        return (
          <div key={review.id} className="rounded-card border border-border bg-surface px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              {review.businessId ? (
                <Link
                  href={`/negocios/${review.businessId}`}
                  className="font-heading text-title-2 font-semibold text-text hover:underline"
                >
                  {review.businessName ?? "Negocio"}
                </Link>
              ) : (
                <span className="font-heading text-title-2 font-semibold text-text">
                  {review.businessName ?? "Negocio"}
                </span>
              )}
              {badge && (
                <span
                  className={`shrink-0 rounded-full px-2 py-1 font-sans text-caption font-medium uppercase tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((position) => (
                <Star
                  key={position}
                  size={16}
                  weight={position <= (review.rating ?? 0) ? "fill" : "regular"}
                  className={position <= (review.rating ?? 0) ? "text-mostaza" : "text-border"}
                />
              ))}
            </div>

            {review.tags && review.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {review.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-terracota/10 px-2.5 py-1 font-sans text-caption font-medium text-terracota"
                  >
                    {REVIEW_TAG_LABELS[tag]}
                  </span>
                ))}
              </div>
            )}

            {review.privateComment && (
              <p className="mt-1 font-sans text-body-sm text-text">{review.privateComment}</p>
            )}
            {review.createdAt && (
              <p className="mt-1 font-sans text-caption text-text-muted">
                {DATE_FORMATTER.format(new Date(review.createdAt))}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
