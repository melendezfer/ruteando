"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { HomeScreenRouter } from "@/components/discovery/home-screen-router";

export default function Home() {
  return (
    <RequireAuth>
      <HomeScreenRouter />
    </RequireAuth>
  );
}
