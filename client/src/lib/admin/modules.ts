import type { Icon } from "@phosphor-icons/react";

/**
 * Registro de módulos del panel de administrador (Fase 1, sin RF
 * asociado — ver CLAUDE.md, requisito explícito del usuario: "estructura
 * del panel como módulos/secciones independientes... así las fases 2-5
 * se agregan como módulos nuevos, no como parches").
 *
 * `requiredRoles` es la única fuente de verdad de qué rol necesita cada
 * módulo del lado del cliente (para decidir qué mostrar en la
 * navegación) — el backend NUNCA confía en esto (regla de seguridad #1):
 * cada módulo futuro protege sus propias rutas con
 * `requireAdminRole(...)` en el servidor, independientemente de si el
 * cliente lo muestra o no en el nav.
 *
 * VACÍO a propósito en esta fase — "NO construyas todavía: colas de
 * decisión... catálogos... estadísticas... identidad", pedido explícito
 * del usuario. Agregar un módulo nuevo (fases 2-5) es solo empujar un
 * objeto acá; `AdminShell` (dashboard/page.tsx) ya itera sobre este
 * array para armar la navegación, sin ningún cambio de estructura.
 */
export type AdminRole = "admin" | "super_admin";

export interface AdminModule {
  id: string;
  label: string;
  path: string;
  icon: Icon;
  requiredRoles: AdminRole[];
}

export const ADMIN_MODULES: AdminModule[] = [];

/** Módulos visibles para un rol dado — un `super_admin` ve todo lo que ve un `admin`, más lo que declare solo para `super_admin`. */
export function modulesForRole(role: AdminRole): AdminModule[] {
  return ADMIN_MODULES.filter((module) => module.requiredRoles.includes(role));
}
