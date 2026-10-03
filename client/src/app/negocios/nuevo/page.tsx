"use client";

import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { MainFloatingNav } from "@/components/layout/main-floating-nav";
import { BusinessRegistrationWizard } from "@/components/business/registration/business-registration-wizard";

/**
 * Asistente de registro (Épica F5). `?negocio=<id>` retoma un registro sin
 * terminar ("Guardar y terminar después"); useSearchParams exige Suspense.
 */
export default function NewBusinessPage() {
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <Suspense fallback={null}>
          <BusinessRegistrationWizard />
        </Suspense>
        <MainFloatingNav />
      </main>
    </RequireAuth>
  );
}
