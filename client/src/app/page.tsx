"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { HomeScreen } from "@/components/discovery/home-screen";

export default function Home() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      {user && (
        <main className="flex flex-1 flex-col">
          <AppHeader activeTab="inicio" />
          <HomeScreen userFirstName={(user.fullName ?? user.email ?? "").split(" ")[0]} />
        </main>
      )}
    </RequireAuth>
  );
}
