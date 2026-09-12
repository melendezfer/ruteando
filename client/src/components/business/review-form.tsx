"use client";

import { useState } from "react";
import { Star, HandHeart } from "@phosphor-icons/react/dist/ssr";
import { api } from "@/lib/api/client";
import { logReviewCreatedEvent } from "@/lib/api/events";
import { getReviewSubmitErrorMessage } from "@/lib/api/error-messages";
import { REVIEW_TAGS, REVIEW_TAG_LABELS, type ReviewTag } from "@/lib/reviews/review-tags";
import { Button } from "@/components/ui/button";

interface ReviewFormProps {
  businessId: string;
}

type Stage = "form" | "submitted" | "already_reviewed";

const RATING_LABELS: Record<number, string> = {
  1: "Muy malo",
  2: "Malo",
  3: "Regular",
  4: "Bueno",
  5: "Muy bueno",
};

/**
 * "Calificar este negocio" (Épica F7, rediseño de reseñas — ver
 * CLAUDE.md): a propósito NO hay ningún campo de texto público. Lo único
 * que sale de acá hacia lo público es `rating` (agregado en
 * BusinessProfile.averageRating/reviewCount, RF-012); `tags` y el
 * comentario son retroalimentación privada — solo el dueño del negocio
 * (GET /businesses/{businessId}/feedback) y el equipo administrador los
 * ven. El mensaje de agradecimiento evita cualquier lenguaje
 * transaccional ("calificación enviada") a propósito: quiere sentirse
 * como un aporte a la comunidad, no como completar un formulario.
 */
export function ReviewForm({ businessId }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [comment, setComment] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tag: ReviewTag) {
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }

  async function handleSubmit() {
    if (rating < 1) return;
    setSubmitting(true);
    setError(null);

    const { response } = await api.POST("/businesses/{businessId}/reviews", {
      params: { path: { businessId } },
      body: {
        rating,
        tags: tags.length > 0 ? tags : undefined,
        privateComment: comment.trim() ? comment.trim() : undefined,
      },
    });

    setSubmitting(false);

    if (response.status === 409) {
      setStage("already_reviewed");
      return;
    }
    if (!response.ok) {
      setError(getReviewSubmitErrorMessage(response.status));
      return;
    }

    logReviewCreatedEvent(businessId);
    setStage("submitted");
  }

  if (stage === "submitted") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-verde/30 bg-verde/10 px-4 py-6 text-center">
        <HandHeart size={28} weight="fill" className="text-verde" />
        <p className="font-sans text-body font-medium text-text">
          Gracias por tu aporte — ayudas a que los vendedores de tu barrio mejoren.
        </p>
      </div>
    );
  }

  if (stage === "already_reviewed") {
    return (
      <div className="rounded-card border border-border bg-surface px-4 py-4 text-center">
        <p className="font-sans text-body-sm text-text-muted">
          Ya calificaste este negocio antes. ¡Gracias por tu aporte!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface px-4 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-title-2 font-semibold text-text">Califica este negocio</h3>
        <p className="font-sans text-body-sm text-text-muted">
          Tu calificación es lo único que se muestra en público. Las etiquetas y el comentario son
          privados: solo los ve el vendedor, como ideas para mejorar.
        </p>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} estrella${value === 1 ? "" : "s"}`}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1"
            >
              <Star
                size={36}
                weight={value <= (hoverRating || rating) ? "fill" : "regular"}
                className={value <= (hoverRating || rating) ? "text-mostaza" : "text-border"}
              />
            </button>
          ))}
        </div>
        {(hoverRating || rating) > 0 && (
          <p className="font-sans text-body-sm text-text-muted">{RATING_LABELS[hoverRating || rating]}</p>
        )}
      </div>

      {rating > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="font-sans text-body-sm font-medium text-text">
              ¿Algo puntual? (opcional, privado)
            </p>
            <div className="flex flex-wrap gap-2">
              {REVIEW_TAGS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1.5 font-sans text-body-sm font-medium transition-colors ${
                      active
                        ? "bg-terracota text-white"
                        : "border border-border bg-background text-text hover:bg-border/40"
                    }`}
                  >
                    {REVIEW_TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-comment" className="font-sans text-body-sm font-medium text-text">
              ¿Quieres contarle algo más al vendedor? (opcional, privado)
            </label>
            <textarea
              id="review-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="rounded-input border border-border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40"
            />
          </div>
        </>
      )}

      {error && <p className="font-sans text-body-sm text-rojo">{error}</p>}

      <Button type="button" onClick={handleSubmit} loading={submitting} disabled={rating < 1}>
        Enviar mi aporte
      </Button>
    </div>
  );
}
