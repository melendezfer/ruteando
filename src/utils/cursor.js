/**
 * Cursor opaco para paginación keyset (Pagination.nextCursor en
 * openapi.yaml) — nunca OFFSET, que degrada linealmente en listas grandes
 * ordenadas por una expresión calculada (ej. distancia). El contenido no
 * es secreto (no lleva nada sensible), solo necesita ser opaco para el
 * cliente y sobrevivir un round-trip en un query string.
 */
function codificar(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Nunca confiar en que un cursor que vuelve del cliente sigue teniendo la
 * forma que se le dio (regla de seguridad #1) — devuelve null ante
 * cualquier cosa que no decodifique a JSON válido; quien llama decide qué
 * hacer con null (típicamente ValidationError).
 */
function decodificar(cursorTexto) {
  try {
    return JSON.parse(Buffer.from(cursorTexto, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = { codificar, decodificar };
