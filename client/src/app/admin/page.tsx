import { redirect } from "next/navigation";

/**
 * `/admin` en sí no renderiza nada propio — el shell real vive en
 * `/admin/dashboard` (RequireAdminAuth decide desde ahí si hace falta
 * mandar a `/admin/login`). Mismo criterio que `/favoritos` → `/mapa`.
 */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
