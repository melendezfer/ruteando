"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNavBar } from "@/components/layout/bottom-nav-bar";
import { ProfileScreen } from "@/components/profile/profile-screen";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <RequireAuth>
      {user && (
        <main className="flex flex-1 flex-col">
          <AppHeader />
          <ProfileScreen user={user} />
          <BottomNavBar />
        </main>
      )}
    </RequireAuth>
  );
}
