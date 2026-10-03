import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SessionNav } from "@/components/layout/session-nav";

/**
 * Páginas legales (aviso de privacidad / términos) — públicas, sin
 * requerir sesión: el checkbox de registro (RF-018, Ley 1581) y
 * ConsentRequiredModal (login) enlazan acá, y un usuario todavía sin
 * cuenta debe poder leerlas antes de decidir aceptar. Texto provisional
 * versión 1.0 (misma versión que se registra en `consentimientos`,
 * MANDATORY_CONSENT_TEXT_VERSION) — el texto legal definitivo, revisado
 * y versionado de verdad, es responsabilidad de la Épica F6 (CLAUDE.md
 * sección 19); esto es lo mínimo real para que el checkbox de "acepto"
 * enlace a algo concreto en vez de a nada.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-background">
      <div className="reserva-columna mx-auto flex w-full max-w-2xl flex-col gap-6 py-10 pl-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 font-sans text-body-sm font-medium text-text-muted hover:text-text"
        >
          <ArrowLeft size={16} weight="bold" />
          Volver
        </Link>
        {children}
      </div>
      <SessionNav />
    </main>
  );
}
