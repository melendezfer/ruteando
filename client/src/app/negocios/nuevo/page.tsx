"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { BusinessRegistrationWizard } from "@/components/business/registration/business-registration-wizard";

/**
 * Épica F5 — sin AppHeader a propósito (CLAUDE.md sección 18: "sin la
 * barra de navegación inferior durante el flujo"). WizardShell reemplaza
 * esa navegación con su propio botón de cierre mientras dura el
 * asistente.
 */
export default function NewBusinessPage() {
  return (
    <RequireAuth>
      <main className="flex flex-1 flex-col">
        <BusinessRegistrationWizard />
      </main>
    </RequireAuth>
  );
}
