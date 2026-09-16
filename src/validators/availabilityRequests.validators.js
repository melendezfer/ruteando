const { z } = require('zod');

const respondAvailabilityRequestSchema = z.object({
  decision: z.enum(['confirmed', 'declined']),
});

// GET /businesses/{businessId}/availability-requests (Fase 3 de
// "vendiendo ahora" — ver CLAUDE.md sección 37). Mismos cursor/limit que
// el resto de las listas paginadas del proyecto; `status` es opcional —
// sin él, cualquier estado.
const listAvailabilityRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'declined', 'expired']).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { respondAvailabilityRequestSchema, listAvailabilityRequestsQuerySchema };
