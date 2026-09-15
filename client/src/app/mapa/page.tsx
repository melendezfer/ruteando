import { redirect } from "next/navigation";

/**
 * El mapa pasa a ser la pantalla principal (`/`) — este redirect queda
 * por si algo externo todavía apunta a `/mapa` (link compartido, marcador
 * guardado), en vez de borrar la ruta.
 */
export default function MapaPage() {
  redirect("/");
}
