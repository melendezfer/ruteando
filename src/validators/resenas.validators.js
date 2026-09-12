const { z } = require('zod');
const { REVIEW_TAG_API_TO_DB } = require('../services/business.mapper');

const REVIEW_TAG_API_VALUES = Object.keys(REVIEW_TAG_API_TO_DB);

const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  // Catálogo fijo y corto (ver business.mapper.js#REVIEW_TAG_DB_TO_API) —
  // ninguna es obligatoria más allá de la calificación. `.refine` en vez
  // de un `Set` a nivel de columna: la duplicación no rompe nada
  // (terminaría guardando el mismo valor dos veces en el array), pero
  // rechazarla temprano evita basura silenciosa en `etiquetas`.
  tags: z
    .array(z.enum(REVIEW_TAG_API_VALUES))
    .max(REVIEW_TAG_API_VALUES.length)
    .refine((valores) => new Set(valores).size === valores.length, {
      message: 'No se puede repetir la misma etiqueta',
    })
    .optional(),
  // Antes público ("comment"), ahora privado — solo lo ve el dueño del
  // negocio y el equipo administrador (ver CLAUDE.md, retroalimentación
  // privada). Renombrado en el contrato, no solo en la base de datos, para
  // que el nombre del campo no siga sugiriendo que es público.
  privateComment: z.string().max(1000).nullable().optional(),
});

// Mismos cursor/limit que negocios.validators — sin filtros propios,
// GET .../feedback solo pagina, no filtra.
const reviewListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { reviewInputSchema, reviewListQuerySchema, REVIEW_TAG_API_VALUES };
