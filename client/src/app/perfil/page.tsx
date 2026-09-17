"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { ProfileScreenRouter } from "@/components/profile/profile-screen-router";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileScreenRouter />
    </RequireAuth>
  );
}
