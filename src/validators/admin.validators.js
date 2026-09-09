const { z } = require('zod');

// Mismo cursor/limit duplicado en business.validators.js/resenas.validators.js
// — sin filtros propios, las 4 colas de moderación de esta épica solo
// paginan.
const adminListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const rejectBusinessSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

// Reusado por POST /admin/reviews/{reviewId}/moderate y
// POST /admin/photos/{photoId}/moderate — misma forma exacta en ambos.
const moderationDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

module.exports = { adminListQuerySchema, rejectBusinessSchema, moderationDecisionSchema };
