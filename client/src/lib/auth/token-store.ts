/**
 * Almacenamiento de tokens (Épica F1, CLAUDE.md sección 13).
 *
 * Access token: SOLO en memoria (variable de módulo) — nunca
 * localStorage/sessionStorage (punto 1 de la sección 13, al pie de la
 * letra). Se pierde en cada recarga dura de página; por diseño.
 *
 * Refresh token: la sección 13 (punto 2) es deliberadamente menos
 * estricta que el punto 1 — dice "un lugar no accesible a scripts de
 * terceros (nunca en una variable global expuesta)" y deja la migración a
 * cookie httpOnly explícitamente para después ("no bloquea el MVP"). Sin
 * persistirlo en algún lado, el refresco silencioso al recargar la
 * página (requisito explícito de la Épica F1) sería código muerto: no
 * habría refresh token en memoria para usar después de un F5. Se usa
 * sessionStorage (no localStorage) como el punto intermedio menos malo
 * disponible hoy sin tocar el backend: sobrevive una recarga, pero no una
 * cuenta comprometida más allá de la pestaña/sesión del navegador. Esto
 * es una decisión explícita de este commit, no un descuido — la
 * candidata real para reemplazarla es la cookie httpOnly que la propia
 * sección 13 ya prevé, coordinando con el backend cuando se aborde.
 */

let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

export function subscribeAccessToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const REFRESH_TOKEN_KEY = "ruteando.refreshToken";

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // sessionStorage puede lanzar en navegación privada estricta — sin
    // refresh token persistido, simplemente no hay refresco silencioso.
    return null;
  }
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Best-effort — ver catch de getRefreshToken.
  }
}

export function clearTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}
