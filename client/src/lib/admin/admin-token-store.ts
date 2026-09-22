/**
 * Almacenamiento de tokens del PANEL DE ADMINISTRADOR (Fase 1, sin RF
 * asociado — ver CLAUDE.md) — deliberadamente SEPARADO de
 * lib/auth/token-store.ts (el de vendedor/consumidor), pedido explícito
 * del usuario: "login de administrador separado... no mismo flujo de
 * usuarios normales". Mismo criterio de seguridad exacto que ese
 * archivo (CLAUDE.md sección 13): access token SOLO en memoria, refresh
 * token en sessionStorage bajo una clave DISTINTA
 * (`ruteando.admin.refreshToken`, nunca `ruteando.refreshToken`) para
 * que las dos sesiones (admin y consumidor/vendedor, si alguien las
 * tuviera abiertas en la misma pestaña) no puedan pisarse entre sí.
 */

let adminAccessToken: string | null = null;

export function getAdminAccessToken(): string | null {
  return adminAccessToken;
}

export function setAdminAccessToken(token: string | null): void {
  adminAccessToken = token;
}

const ADMIN_REFRESH_TOKEN_KEY = "ruteando.admin.refreshToken";

export function getAdminRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.sessionStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
    }
  } catch {
    // Best-effort — mismo criterio que token-store.ts.
  }
}

export function clearAdminTokens(): void {
  setAdminAccessToken(null);
  setAdminRefreshToken(null);
}
