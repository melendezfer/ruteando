const { z } = require('zod');
const { ValidationError } = require('../errors');

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

// Mismo shape que ya se repetía suelto en negocios.service.js y
// resenas.service.js (fechaCreacion + id como desempate) — no exige ISO
// estricto a propósito: el valor viaja tal cual lo devolvió Postgres
// (columna_fecha_creacion::text, precisión de microsegundos) y se manda de
// vuelta sin tocar para el cast $N::timestamptz; el único requisito real es
// que Date.parse() lo reconozca como fecha.
const CURSOR_FECHA_ID_SCHEMA = z.object({
  fechaCreacion: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(Date.parse(v)), {
      message: 'fechaCreacion no es una fecha válida',
    }),
  id: z.string().uuid(),
});

/**
 * Decodifica y valida un cursor con forma {fechaCreacion, id} — usado por
 * las colas de moderación de la Épica 9 (negocios pendientes, reseñas y
 * fotos reportadas, reportes de negocio desactualizado), todas ordenadas
 * por fecha_creacion con id como desempate. Un cursor que no decodifica a
 * esta forma se rechaza con 422 antes de llegar a la consulta
 * parametrizada, nunca con un error crudo de Postgres.
 */
function decodificarCursorFechaId(cursorTexto) {
  if (!cursorTexto) return null;
  const payload = decodificar(cursorTexto);
  const resultado = CURSOR_FECHA_ID_SCHEMA.safeParse(payload);
  if (!resultado.success) {
    throw new ValidationError('El cursor de paginación no es válido', {
      errors: [{ field: 'cursor', message: 'Formato de cursor inválido o corrupto' }],
    });
  }
  return resultado.data;
}

module.exports = { codificar, decodificar, decodificarCursorFechaId };
