import { redirect } from "next/navigation";

/**
 * Redediseño de navegación global (sin RF asociado, petición directa del
 * usuario, ver CLAUDE.md): "Favoritos" deja de ser una pantalla propia
 * (`FavoritesScreen`, con `BusinessCard`) — ahora se ve como una lista
 * filtrada de pantalla completa dentro del mapa (`FilteredListSheet`,
 * mismo componente de fila que el banner de descubrimiento), alcanzable
 * desde el ícono de la sección "Favoritos abiertos ahora" del banner o
 * desde el acceso de corazón en la navegación flotante
 * (`MainFloatingNav`). Esta ruta queda como redirect (no se borra del
 * todo) por si algún enlace/marcador externo todavía apunta acá — mismo
 * criterio ya usado antes con `/mapa` cuando esa ruta cambió de sentido
 * (CLAUDE.md sección 18).
 */
export default function FavoritesPage() {
  redirect("/mapa?favoritesOnly=true");
}
