const { z } = require('zod');

// Mismos cursor/limit que las demás listas paginadas. `openNow` (sin RF
// asociado, petición directa del usuario — banner de descubrimiento,
// familia "Favoritos abiertos ahora"): mismo query param booleano que ya
// usan /businesses y /businesses/nearby (ver business.validators.js) —
// mismo enum explícito ahí, no `z.coerce.boolean()`: los query params
// siempre llegan como string y `Boolean("false")` es `true` (coerciona
// cualquier string no vacío).
const favoritesListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  openNow: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

module.exports = { favoritesListQuerySchema };
