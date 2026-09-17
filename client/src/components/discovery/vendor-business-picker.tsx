"use client";

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import type { components } from "@/lib/api/schema";

type Business = components["schemas"]["Business"];

/**
 * Selector "¿cuál de tus negocios quieres ver?" — extraído de
 * `home-screen-router.tsx` (sin RF asociado, ver CLAUDE.md) para
 * reusarlo también en `profile-screen-router.tsx`, ambos casos de un
 * vendedor con 2+ negocios activos. Solo llega acá con negocios ya
 * filtrados a `status: "active"` (ver `useVendorActiveBusinesses`) — no
 * hace falta mostrar el estado en cada fila, siempre sería el mismo.
 */
export function VendorBusinessPicker({ businesses }: { businesses: Business[] }) {
  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <h1 className="font-heading text-title-1 font-bold text-text">
          ¿Cuál de tus negocios quieres ver?
        </h1>
        <div className="flex flex-col gap-2">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/negocios/${business.id}`}
              className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3 hover:bg-background"
            >
              <span className="font-sans text-body font-medium text-text">{business.name}</span>
              <CaretRight size={18} className="text-text-muted" />
            </Link>
          ))}
        </div>
      </div>
      <BottomNavBar />
    </main>
  );
}
