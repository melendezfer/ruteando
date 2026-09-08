const { z } = require('zod');
const { EVENT_METADATA_MAX_BYTES } = require('../config/constants');

const eventInputSchema = z.object({
  type: z.enum([
    'search',
    'business_view',
    'product_view',
    'contact_click',
    'favorite_added',
    'review_created',
    'business_registered',
  ]),
  // .uuid() valida el formato antes de llegar a la base de datos — un
  // businessId con forma inválida ("abc123") se rechaza acá con 422. Un
  // UUID bien formado pero que no corresponde a ningún negocio real SÍ
  // pasa este schema — esa verificación es de existencia, no de formato,
  // y se resuelve en eventos.service.js de forma tolerante (queda como
  // negocio_id null en vez de fallar la solicitud completa: es analítica
  // de mejor esfuerzo, "202 Accepted" ya es la semántica del contrato).
  businessId: z.string().uuid().nullable().optional(),
  metadata: z
    .object({})
    .loose()
    .nullable()
    .optional()
    .refine(
      (v) => v == null || Buffer.byteLength(JSON.stringify(v), 'utf8') <= EVENT_METADATA_MAX_BYTES,
      { message: `metadata no puede pesar más de ${EVENT_METADATA_MAX_BYTES} bytes` },
    ),
});

module.exports = { eventInputSchema };
