import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/api/client";
import { BusinessProfileScreen } from "@/components/business/business-profile-screen";
import type { components } from "@/lib/api/schema";

type BusinessProfile = components["schemas"]["BusinessProfile"];

interface PageParams {
  businessId: string;
}

interface PageProps {
  params: Promise<PageParams>;
}

/**
 * Server Component a propósito (CLAUDE.md sección 12): un link de perfil
 * compartido por WhatsApp necesita una vista previa enriquecida (Open
 * Graph) al pegarse en el chat, algo imposible con un SPA 100%
 * client-side. `getBusinessProfile`/`getCategoryName` se llaman tanto
 * acá como en generateMetadata con los mismos parámetros — Next.js
 * deduplica automáticamente ambas llamadas en una sola petición real
 * (Request Memoization), así que no hace falta cachear a mano.
 */
async function getBusinessProfile(businessId: string): Promise<BusinessProfile | null> {
  const { data, response } = await api.GET("/businesses/{businessId}", {
    params: { path: { businessId } },
    cache: "no-store",
  });
  if (!response.ok || !data) return null;
  return data;
}

async function getCategoryName(categoryId: number | null | undefined): Promise<string | null> {
  if (categoryId == null) return null;
  const { data } = await api.GET("/categories", { cache: "no-store" });
  return data?.find((category) => category.id === categoryId)?.name ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { businessId } = await params;
  const profile = await getBusinessProfile(businessId);

  if (!profile) {
    return { title: "Negocio no encontrado — Ruteando" };
  }

  const heroPhotoUrl = profile.photos?.find((photo) => photo.type === "business")?.url;
  const ratingText = profile.averageRating != null ? ` — ${profile.averageRating.toFixed(1)}★` : "";
  const description = `Comida callejera en Ciudad Verde, Soacha${ratingText}. Contáctalos directo por WhatsApp en Ruteando.`;
  const title = `${profile.name ?? "Negocio"} — Ruteando`;

  return {
    title,
    description,
    openGraph: {
      title: profile.name ?? "Ruteando",
      description,
      images: heroPhotoUrl ? [{ url: heroPhotoUrl }] : undefined,
    },
  };
}

export default async function BusinessProfilePage({ params }: PageProps) {
  const { businessId } = await params;
  const profile = await getBusinessProfile(businessId);

  if (!profile) notFound();

  const categoryName = await getCategoryName(profile.categoryId);

  return <BusinessProfileScreen profile={profile} categoryName={categoryName} />;
}
