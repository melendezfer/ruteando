import { AdminAuthProvider } from "@/lib/admin/admin-auth-context";

/**
 * Layout ANIDADO (no un root layout aparte — Next.js App Router solo
 * permite eso con route groups que envuelvan TODA la app, un
 * refactor que no se pidió y que arriesgaría el resto de las rutas ya
 * existentes) — se monta DENTRO de app/layout.tsx (que sigue envolviendo
 * absolutamente todo, incluida esta sección, con su propio
 * AuthProvider/FavoritesProvider de vendedor/consumidor). Ese
 * `AuthProvider` de afuera no interfiere acá: solo intenta un refresco
 * silencioso contra SU PROPIO refresh token (sessionStorage,
 * `ruteando.refreshToken`), que en `/admin/*` normalmente no existe —
 * `AdminAuthProvider` es el único que de verdad importa para todo lo
 * que cuelga de este layout.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
