"use client";

import Link from "next/link";
import { CookingPot } from "@phosphor-icons/react/dist/ssr";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { HomeScreen } from "@/components/discovery/home-screen";

export default function Home() {
  const { status, user, logout } = useAuth();

  if (status === "loading") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <CookingPot size={48} weight="duotone" className="text-terracota" />
        <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>
        <p className="font-sans text-body text-text-muted">Cargando sesión…</p>
      </main>
    );
  }

  if (status === "unauthenticated") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <CookingPot size={48} weight="duotone" className="text-terracota" />
        <h1 className="font-heading text-display font-bold text-text">Ruteando</h1>
        <p className="max-w-sm font-sans text-body text-text-muted">
          Encuentra comida callejera cerca de ti y contacta al vendedor directo por WhatsApp.
        </p>
        <div className="flex gap-3">
          <Link href="/login">
            <Button type="button">Iniciar sesión</Button>
          </Link>
          <Link href="/register">
            <Button type="button" variant="secondary">
              Crear cuenta
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="flex items-center gap-2 font-heading text-title-2 font-bold text-text">
          <CookingPot size={24} weight="duotone" className="text-terracota" />
          Ruteando
        </span>
        <Button type="button" variant="secondary" onClick={() => logout()}>
          Cerrar sesión
        </Button>
      </header>
      <HomeScreen userFirstName={(user.fullName ?? user.email ?? "").split(" ")[0]} />
    </main>
  );
}
