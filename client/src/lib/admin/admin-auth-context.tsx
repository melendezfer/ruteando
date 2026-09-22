"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { adminApi } from "@/lib/admin/admin-api-client";
import {
  clearAdminTokens,
  getAdminRefreshToken,
  setAdminAccessToken,
  setAdminRefreshToken,
} from "@/lib/admin/admin-token-store";
import type { components } from "@/lib/api/schema";

type Administrator = components["schemas"]["Administrator"];

export type AdminAuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AdminAuthResult {
  ok: boolean;
  message?: string;
}

interface AdminAuthContextValue {
  status: AdminAuthStatus;
  admin: Administrator | null;
  login: (email: string, password: string) => Promise<AdminAuthResult>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

/**
 * Sesión del panel de administrador (Fase 1, sin RF asociado — ver
 * CLAUDE.md) — mismo patrón exacto que AuthProvider (lib/auth/auth-context.tsx):
 * access token solo en memoria, refresco silencioso al montar contra
 * POST /admin-panel/auth/refresh, `status` no baja de "loading" hasta
 * que ese refresco (o su ausencia) se resuelve. Deliberadamente
 * SEPARADO de AuthProvider — token store propio (admin-token-store.ts),
 * cliente HTTP propio (admin-api-client.ts), sin ningún estado
 * compartido con la sesión de vendedor/consumidor.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminAuthStatus>("loading");
  const [admin, setAdmin] = useState<Administrator | null>(null);
  // Mismo motivo que auth-context.tsx: evita el doble refresh de React
  // Strict Mode con un refresh token de un solo uso.
  const hasAttemptedRefresh = useRef(false);

  const applySessionAndFetchAdmin = useCallback(
    async (tokens: { accessToken?: string; refreshToken?: string }) => {
      if (!tokens.accessToken) return false;
      setAdminAccessToken(tokens.accessToken);
      if (tokens.refreshToken) setAdminRefreshToken(tokens.refreshToken);

      const { data: me, error } = await adminApi.GET("/admin-panel/me");
      if (error || !me) {
        clearAdminTokens();
        setAdmin(null);
        setStatus("unauthenticated");
        return false;
      }

      setAdmin(me);
      setStatus("authenticated");
      return true;
    },
    [],
  );

  useEffect(() => {
    if (hasAttemptedRefresh.current) return;
    hasAttemptedRefresh.current = true;

    async function attemptSilentRefresh() {
      const refreshToken = getAdminRefreshToken();
      if (!refreshToken) {
        setStatus("unauthenticated");
        return;
      }

      const { data, error } = await adminApi.POST("/admin-panel/auth/refresh", {
        body: { refreshToken },
      });

      if (error || !data?.accessToken) {
        clearAdminTokens();
        setStatus("unauthenticated");
        return;
      }

      await applySessionAndFetchAdmin(data);
    }

    attemptSilentRefresh();
  }, [applySessionAndFetchAdmin]);

  const login = useCallback(
    async (email: string, password: string): Promise<AdminAuthResult> => {
      const { data, error, response } = await adminApi.POST("/admin-panel/auth/login", {
        body: { email, password },
      });

      if (error || !data?.accessToken) {
        if (!response) return { ok: false, message: "No pudimos conectar con el servidor." };
        return { ok: false, message: "Correo o contraseña incorrectos." };
      }

      const ok = await applySessionAndFetchAdmin(data);
      return ok ? { ok: true } : { ok: false, message: "No pudimos iniciar la sesión." };
    },
    [applySessionAndFetchAdmin],
  );

  const logout = useCallback(async () => {
    const refreshToken = getAdminRefreshToken();
    if (refreshToken) {
      await adminApi.POST("/admin-panel/auth/logout", { body: { refreshToken } }).catch(() => undefined);
    }
    clearAdminTokens();
    setAdmin(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AdminAuthContext.Provider value={{ status, admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth debe usarse dentro de <AdminAuthProvider>");
  return context;
}
