const { z } = require('zod');

// Mismos cursor/limit que las demás listas paginadas — GET
// /users/me/favorites no tiene filtros propios, solo pagina.
const favoritesListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { favoritesListQuerySchema };
