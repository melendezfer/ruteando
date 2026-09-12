"use client";

import { useEffect, useState } from "react";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";
import { REVIEW_TAG_LABELS } from "@/lib/reviews/review-tags";
import { Skeleton } from "@/components/discovery/skeleton";

type ReviewFeedback = components["schemas"]["ReviewFeedback"];

interface BusinessFeedbackPanelProps {
  businessId: string;
}

const FEEDBACK_LIMIT = 50;
const DATE_FORMATTER = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

/**
 * "Ideas de tus clientes para mejorar" (Épica F7, rediseño de reseñas —
 * ver CLAUDE.md): solo el dueño del negocio la ve
 * (GET /businesses/{businessId}/feedback, 403 para cualquier otro). A
 * propósito NO muestra quién escribió cada aporte — el contrato
 * (ReviewFeedback) ni siquiera trae userId, así que no hay nada que
 * ocultar en el frontend, es estructuralmente imposible mostrarlo. El
 * encabezado evita a propósito palabras como "quejas" o "reportes" — la
 * idea es que se sienta como retroalimentación constructiva, no como una
 * bandeja de reclamos.
 */
export function BusinessFeedbackPanel({ businessId }: BusinessFeedbackPanelProps) {
  const [feedback, setFeedback] = useState<ReviewFeedback[] | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .GET("/businesses/{businessId}/feedback", {
        params: { path: { businessId }, query: { limit: FEEDBACK_LIMIT } },
      })
      .then(({ data }) => {
        if (!ignore) setFeedback(data?.data ?? []);
      });
    return () => {
      ignore = true;
    };
  }, [businessId]);

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-title-2 font-semibold text-text">
          Ideas de tus clientes para mejorar
        </h2>
        <p className="font-sans text-body-sm text-text-muted">
          Solo tú puedes ver esto — es anónimo, no sabemos quién escribió cada aporte.
        </p>
      </div>

      {feedback === null && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {feedback !== null && feedback.length === 0 && (
        <p className="font-sans text-body-sm text-text-muted">
          Todavía no tienes ideas de tus clientes. Aparecerán acá apenas alguien te califique.
        </p>
      )}

      {feedback !== null && feedback.length > 0 && (
        <div className="flex flex-col gap-3">
          {feedback.map((item) => (
            <div key={item.id} className="rounded-card border border-border bg-background px-4 py-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((position) => (
                  <Star
                    key={position}
                    size={16}
                    weight={position <= (item.rating ?? 0) ? "fill" : "regular"}
                    className={position <= (item.rating ?? 0) ? "text-mostaza" : "text-border"}
                  />
                ))}
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-terracota/10 px-2.5 py-1 font-sans text-caption font-medium text-terracota"
                    >
                      {REVIEW_TAG_LABELS[tag]}
                    </span>
                  ))}
                </div>
              )}

              {item.privateComment && (
                <p className="mt-2 font-sans text-body-sm text-text">{item.privateComment}</p>
              )}

              {item.createdAt && (
                <p className="mt-1 font-sans text-caption text-text-muted">
                  {DATE_FORMATTER.format(new Date(item.createdAt))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
