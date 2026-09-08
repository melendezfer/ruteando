const { z } = require('zod');

const reviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
});

// Mismos cursor/limit que negocios.validators — sin filtros propios,
// GET .../reviews solo pagina, no filtra.
const reviewListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { reviewInputSchema, reviewListQuerySchema };
