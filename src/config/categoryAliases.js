/**
 * Búsqueda por familia (Fase 5 de la fusión de buscadores, petición
 * directa del usuario, sin RF asociado — ver CLAUDE.md sección 45): un
 * consumidor que busca "droguerías" o "tintos" no necesariamente conoce
 * ni escribe el nombre exacto de la categoría ("Droguerías", "Tintos y
 * café") — `q` ya compara contra el nombre de categoría tal cual
 * (negocios.repository.js#agregarFiltrosComunes), pero eso solo cubre
 * coincidencia literal. Este diccionario cubre los términos coloquiales
 * que no calzan 1 a 1 con ningún nombre de categoría real.
 *
 * Catálogo corto a propósito (mismo criterio que el catálogo de
 * etiquetas de reseñas, CLAUDE.md sección 26/33) — cubre los términos
 * que el usuario pidió explícitamente ("comidas rápidas", "droguerías",
 * "tintos") más un puñado de sinónimos obvios para las categorías reales
 * ya sembradas, no un intento de anticipar cada término coloquial
 * posible. Administrado en código (sin tabla ni panel), como el resto de
 * los catálogos fijos y cortos de este proyecto — cambiarlo requiere un
 * despliegue de backend, no un endpoint de administración.
 */
const ALIAS_A_CATEGORIAS = {
  'comida rapida': ['Comida rápida'],
  'comidas rapidas': ['Comida rápida'],
  'fast food': ['Comida rápida'],
  drogueria: ['Droguerías'],
  droguerias: ['Droguerías'],
  farmacia: ['Droguerías'],
  farmacias: ['Droguerías'],
  tinto: ['Tintos y café'],
  tintos: ['Tintos y café'],
  cafe: ['Tintos y café'],
  cafeteria: ['Tintos y café'],
  cafeterias: ['Tintos y café'],
  fruteria: ['Fruver'],
  verduleria: ['Fruver'],
  postre: ['Dulces y postres', 'Postres'],
  postres: ['Dulces y postres', 'Postres'],
  dulces: ['Dulces y postres'],
  jugo: ['Jugos naturales'],
  jugos: ['Jugos naturales'],
  sastreria: ['Costura y sastrería'],
  costura: ['Costura y sastrería'],
  modista: ['Costura y sastrería'],
  abogado: ['Servicios legales básicos'],
  abogados: ['Servicios legales básicos'],
  'asesoria legal': ['Servicios legales básicos'],
  artesania: ['Artesanías'],
  artesanias: ['Artesanías'],
};

// Sin acentos, minúsculas, sin espacios sobrantes — así "tintos" matchea
// "Tintos y café" en el diccionario sin depender de que el usuario
// escriba la tilde de "café", y sin usar la extensión `unaccent` de
// Postgres (esta resolución vive enteramente en JS, antes de tocar la
// base de datos).
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Umbral mínimo para el lado de `q` (no para el alias) — sin esto, un
// `q` de 1-2 caracteres (ej. "a") aparecería "contenido" dentro de casi
// cualquier alias del diccionario, devolviendo categorías que no tienen
// ninguna relación real con lo que el usuario escribió.
const LARGO_MINIMO_Q = 3;

/**
 * Nombres de categoría (reales, tal cual están en `categorias.nombre`)
 * que el texto libre `q` activa por alias — comparación bidireccional
 * ("tinto" dentro de "tintos y café" buscado, o "café" dentro de un `q`
 * más largo) sobre texto normalizado. Devuelve `[]` si `q` no matchea
 * ningún alias (o es demasiado corto) — el caller decide qué hacer con
 * una lista vacía (negocios.repository.js no agrega ninguna cláusula
 * extra en ese caso, el match por nombre de categoría literal sigue
 * aplicando igual).
 */
function resolverCategoriasPorAlias(q) {
  if (!q) return [];
  const normalizado = normalizar(q);
  if (normalizado.length < LARGO_MINIMO_Q) return [];

  const categorias = new Set();
  for (const [alias, nombres] of Object.entries(ALIAS_A_CATEGORIAS)) {
    const aliasNormalizado = normalizar(alias);
    if (normalizado.includes(aliasNormalizado) || aliasNormalizado.includes(normalizado)) {
      nombres.forEach((nombre) => categorias.add(nombre));
    }
  }
  return [...categorias];
}

module.exports = { resolverCategoriasPorAlias };
