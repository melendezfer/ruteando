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
import { api } from "@/lib/api/client";
import {
  clearTokens,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "@/lib/auth/token-store";
import {
  getFieldErrors,
  getLoginErrorMessage,
  getMissingConsentTypes,
  getNetworkErrorMessage,
  getRegisterErrorMessage,
} from "@/lib/api/error-messages";
import { grantMandatoryConsents, type MandatoryConsentType } from "@/lib/api/consents";
import type { components } from "@/lib/api/schema";

type User = components["schemas"]["User"];

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
  /**
   * Presente (y no vacío) solo cuando POST /auth/login devolvió 403
   * consent-required — la pantalla de login lo usa para abrir
   * ConsentRequiredModal en vez de mostrar `message` como un error de
   * formulario sin salida (RF-018, bug real: una cuenta ya creada sin
   * este consentimiento quedaba bloqueada para siempre, ver
   * CLAUDE.md).
   */
  missingConsentTypes?: MandatoryConsentType[];
}

interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role: "consumer" | "vendor";
}

interface LoginConsentInput {
  type: MandatoryConsentType;
  textVersion: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string, consents?: LoginConsentInput[]) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Épica F1 (CLAUDE.md sección 13, al pie de la letra): el access token
 * vive en memoria (token-store.ts); acá solo se orquesta cuándo pedirlo,
 * refrescarlo y a quién avisarle. `status` empieza en "loading" y no baja
 * a "authenticated"/"unauthenticated" hasta que el refresco silencioso
 * (o su ausencia) se resuelve — ninguna pantalla que dependa de sesión
 * debe renderizar antes de eso.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  // Guarda contra el doble-invocado de efectos de React Strict Mode (modo
  // desarrollo): sin esto, el efecto de abajo corre dos veces al montar,
  // dispara dos POST /auth/refresh casi simultáneos con el MISMO refresh
  // token (de un solo uso) — el primero rota el token con éxito, el
  // segundo llega con el token ya usado y el backend, al detectar reuso
  // (RFC 9700), revoca TODA la familia de tokens como medida de
  // seguridad, incluido el que el primer POST acababa de emitir. Bug real
  // encontrado verificando el flujo contra el backend real, no un
  // artefacto de prueba — un `useRef` (persiste entre las dos
  // invocaciones del mismo montaje, a diferencia de una variable local
  // del efecto) asegura que el refresco de verdad solo se intente una vez
  // por montaje.
  const hasAttemptedRefresh = useRef(false);
  const [user, setUser] = useState<User | null>(null);

  const applySessionAndFetchUser = useCallback(
    async (tokens: { accessToken?: string; refreshToken?: string }) => {
      if (!tokens.accessToken) return false;
      setAccessToken(tokens.accessToken);
      if (tokens.refreshToken) setRefreshToken(tokens.refreshToken);

      // No basta con confiar en el `user` que ya trae AuthTokens: pedirlo
      // de nuevo contra GET /users/me ejercita el camino completo
      // (header Authorization + middleware authenticate del backend) y
      // confirma que el access token realmente sirve para autenticar,
      // no solo que el endpoint de login/refresh respondió 200.
      const { data: me, error } = await api.GET("/users/me");
      if (error || !me) {
        clearTokens();
        setUser(null);
        setStatus("unauthenticated");
        return false;
      }

      setUser(me);
      setStatus("authenticated");
      return true;
    },
    [],
  );

  useEffect(() => {
    if (hasAttemptedRefresh.current) return;
    hasAttemptedRefresh.current = true;

    // Sin cleanup con una bandera "cancelled": AuthProvider vive en la
    // raíz del árbol (layout.tsx) y no se desmonta de verdad durante la
    // vida de la pestaña — la única "cancelación" que existiría sería la
    // que simula Strict Mode, y ya la cubre hasAttemptedRefresh.current
    // arriba. Agregar esa bandera de todas formas fue justo el bug: la
    // cancelación sintética de Strict Mode la marcaba en `true` antes de
    // que el único intento real terminara, dejando `status` trabado en
    // "loading" para siempre (nunca se aplicaba el resultado ni del éxito
    // ni del error).
    async function attemptSilentRefresh() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setStatus("unauthenticated");
        return;
      }

      const { data, error } = await api.POST("/auth/refresh", { body: { refreshToken } });

      if (error || !data?.accessToken) {
        clearTokens();
        setStatus("unauthenticated");
        return;
      }

      await applySessionAndFetchUser(data);
    }

    attemptSilentRefresh();
  }, [applySessionAndFetchUser]);

  const login = useCallback(
    async (email: string, password: string, consents?: LoginConsentInput[]): Promise<AuthResult> => {
      const { data, error, response } = await api.POST("/auth/login", {
        body: { email, password, ...(consents ? { consents } : {}) },
      });

      if (error || !data?.accessToken) {
        if (!response) return { ok: false, message: getNetworkErrorMessage() };

        // 403 en /auth/login es siempre consent-required (el único 403
        // que declara esa ruta) — bug real reportado en producción
        // (2026-09-11): una cuenta ya creada sin este consentimiento
        // (ej. de antes de que el registro pidiera el checkbox) quedaba
        // bloqueada para siempre, sin ninguna pantalla donde otorgarlo.
        // LoginPage usa este campo para abrir ConsentRequiredModal en
        // vez de mostrar `message` como un callejón sin salida.
        const missingConsentTypes = response.status === 403 ? getMissingConsentTypes(error) : [];

        return {
          ok: false,
          message: getLoginErrorMessage(response.status),
          fieldErrors: getFieldErrors(error),
          status: response.status,
          missingConsentTypes: missingConsentTypes.length > 0 ? missingConsentTypes : undefined,
        };
      }

      const ok = await applySessionAndFetchUser(data);
      return ok ? { ok: true } : { ok: false, message: getNetworkErrorMessage() };
    },
    [applySessionAndFetchUser],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<AuthResult> => {
      const { data, error, response } = await api.POST("/auth/register", { body: input });

      if (error || !data?.accessToken) {
        if (!response) return { ok: false, message: getNetworkErrorMessage() };
        return {
          ok: false,
          message: getRegisterErrorMessage(response.status),
          fieldErrors: getFieldErrors(error),
          status: response.status,
        };
      }

      const ok = await applySessionAndFetchUser(data);
      if (!ok) return { ok: false, message: getNetworkErrorMessage() };

      // El formulario de registro exige el checkbox de tratamiento de
      // datos/términos y condiciones antes de poder enviarse (RF-018,
      // Ley 1581, sección 4 de CLAUDE.md) — se otorgan acá, ya
      // autenticados con el token recién emitido por
      // applySessionAndFetchUser, en vez de agregarlos al propio
      // POST /auth/register (que a propósito no cambia, ver CLAUDE.md
      // sección 10 "Épica 8"). Best-effort: si esta llamada falla (red,
      // etc.), la cuenta ya quedó creada y con sesión igual —
      // ConsentRequiredModal (login) es la red de seguridad la próxima
      // vez que login()/refresh() lo exijan, en vez de dejar la cuenta
      // bloqueada para siempre como el bug que esto corrige.
      await grantMandatoryConsents().catch(() => undefined);

      return { ok: true };
    },
    [applySessionAndFetchUser],
  );

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Best-effort: si la llamada falla (red caída, token ya inválido),
      // igual se cierra la sesión del lado del cliente — logout nunca
      // debe dejar a alguien "atrapado" con sesión activa en la UI.
      await api.POST("/auth/logout", { body: { refreshToken } }).catch(() => undefined);
    }
    clearTokens();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return context;
}
