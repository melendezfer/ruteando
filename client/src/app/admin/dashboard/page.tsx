"use client";

import Link from "next/link";
import { SignOut, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { useAdminAuth } from "@/lib/admin/admin-auth-context";
import { RequireAdminAuth } from "@/components/admin/require-admin-auth";
import { RuteandoLogo } from "@/components/ui/ruteando-logo";
import { modulesForRole } from "@/lib/admin/modules";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  super_admin: "Administrador maestro",
};

/**
 * Shell del panel de administrador (Fase 1, sin RF asociado — ver
 * CLAUDE.md): header (marca + admin logueado + cerrar sesión) + nav
 * lateral construida a partir de `ADMIN_MODULES` (lib/admin/modules.ts,
 * vacío en esta fase a propósito) + un área de contenido vacía. Las
 * fases 2-5 agregan sus propias rutas bajo `/admin/<módulo>` y un
 * objeto nuevo en ese registro — este archivo no debería necesitar
 * cambios de estructura cuando eso pase, solo ganar entradas en el nav.
 */
export default function AdminDashboardPage() {
  return (
    <RequireAdminAuth>
      <AdminDashboardContent />
    </RequireAdminAuth>
  );
}

function AdminDashboardContent() {
  const { admin, logout } = useAdminAuth();
  const modules = admin ? modulesForRole(admin.role as "admin" | "super_admin") : [];

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-surface px-5 py-3">
        <div className="flex items-center gap-2">
          <RuteandoLogo size={24} />
          <span className="font-heading text-title-2 font-bold text-terracota">Ruteando</span>
          <span className="font-sans text-body-sm text-text-muted">· Panel de administrador</span>
        </div>
        <div className="flex items-center gap-3">
          {admin && (
            <div className="flex flex-col items-end">
              <span className="font-sans text-body-sm font-medium text-text">{admin.fullName}</span>
              <span className="font-sans text-caption text-text-muted">
                {ROLE_LABEL[admin.role ?? ""] ?? admin.role}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:bg-background hover:text-text"
          >
            <SignOut size={18} weight="bold" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
          {modules.length === 0 ? (
            <p className="p-2 font-sans text-body-sm text-text-muted">
              Todavía no hay módulos habilitados.
            </p>
          ) : (
            modules.map((module) => {
              const ModuleIcon = module.icon;
              return (
                <Link
                  key={module.id}
                  href={module.path}
                  className="flex items-center gap-2 rounded-input px-3 py-2 font-sans text-body-sm font-medium text-text-muted transition-colors hover:bg-background hover:text-text"
                >
                  <ModuleIcon size={18} weight="bold" />
                  {module.label}
                </Link>
              );
            })
          )}
        </nav>

        <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <SquaresFour size={48} weight="duotone" className="text-text-muted" />
          <h1 className="font-heading text-title-1 font-bold text-text">Bienvenido al panel</h1>
          <p className="max-w-sm font-sans text-body-sm text-text-muted">
            Esta es la base del panel de administrador — las secciones (negocios pendientes,
            moderación, catálogos, estadísticas) se irán agregando acá como módulos nuevos.
          </p>
        </main>
      </div>
    </div>
  );
}
